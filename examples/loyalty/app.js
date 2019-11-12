import ClientView from './client';
import BonusView from './bonus';
import ConfigView from './functions';

/**
 * Отвечает за общую логику приложения,
 * обрабатывает ивенты Poster и отображает разные компоненты
 */
export default class LoyaltyApp extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            place: 'order', // Доступные варианты: order | beforeOrderClose
            clientGroups: [], // Группы клиентов в Poster
            currentClient: null,
            currentOrder: null,
            templates: [],
            currentTemplateIdx: 0,
        };
    }

    componentDidMount() {
        // Показываем кнопки в интерфейсе Poster
        Poster.interface.showApplicationIconAt({
            order: 'Электронная карта',
            functions: 'U-CARD настройки',
            // payment: 'U-CARD | списание',
        });

        // Подписываемся на ивенты Poster
        // Poster.on('applicationIconClicked', this.showPopup);
        Poster.on('applicationIconClicked', (data) => {
            this.showPopup(data);
            // if (data.place === 'functions') {
            //     this.showPopup({place: 'functions'});
            // }
            //
            // if (data.place === 'order') {
            //     this.showPopup({place: 'order'});
            // }
        });
        Poster.on('beforeOrderClose', (data, next) => {
            // Сохранили callback чтобы закрыть заказ
            this.next = next;
            this.showPopup({place: 'beforeOrderClose'});
        });

        this.getClientsGroups();
        this.getTemplates();
    }

    /**
     * Получает группы клиентов из Poster
     */
    getClientsGroups = () => {
        Poster.makeApiRequest('clients.getGroups', {method: 'get'}, (groups) => {
            if (groups) {
                // Не показываем удаленные группы
                groups = _.filter(groups, g => parseInt(g.delete) === 0);
                this.setState({clientGroups: groups});
            }
        });
    };

    /**
     * Получает текущий заказ и клиента этого заказа
     * @return {PromiseLike<{order, client}>}
     */
    getCurrentClient = () => {
        let activeOrder = null;

        return Poster.orders.getActive()
            .then((data) => {
                if (data.order && data.order.clientId) {
                    activeOrder = data.order;
                    return Poster.clients.get(Number(data.order.clientId));
                }
                return null;
            })
            .then(client => ({order: activeOrder, client}));
    };

    /**
     * Добавляет клиента к текущему заказу
     * @param order
     * @param newClient
     */
    setOrderClient = (order, newClient) => {
        // TODO: в этом методе можно

        Poster.clients
            .find({searchVal: newClient.phone})
            .then((result) => {
                // Если нашли хоть одного клиента, добавляем к заказу
                if (result && result.foundClients && result.foundClients.length) {
                    return result.foundClients[0];
                }

                // Создаем нового клиента
                return Poster.clients.create({
                    client: {
                        client_sex: 1,
                        client_name: newClient.name,
                        phone: newClient.phone,
                        client_groups_id_client: newClient.groupId,
                        bonus: 0,
                    },
                });
            })
            .then((client) => {
                // Отобразили клиента
                this.setState({currentOrder: order, currentClient: client});

                // Привязали к заказу
                Poster.orders.setOrderClient(order.id, client.id);
            })
            .catch((err) => {
                console.error(err);
            });
    };

    /**
     * Списывает бонусы
     * @param bonus
     */
    withdrawBonus = (bonus) => {
        const {currentOrder} = this.state;

        bonus = parseFloat(bonus);

        Poster.orders.setOrderBonus(currentOrder.id, bonus);
        Poster.interface.closePopup();

        // Продолжаем стандартный флоу закрытия заказа Poster (показывем окно заказа)
        this.next();
    };

    /**
     * Показывает интерфейс в зависимости от места в котором интерфейс вызывают
     * @param data
     */
    showPopup = (data) => {
        if (data.place === 'functions') {
            this.setState({place: 'functions'});
            Poster.interface.popup({width: 600, height: 400, title: 'Настройки приложения'});
        }

        if (data.place === 'order') {
            this.getCurrentClient()
                .then((info) => {
                    this.setState({currentClient: info.client, currentOrder: data.order, place: 'order'});

                    Poster.interface.popup({width: 600, height: 400, title: 'Карта лояльности'});
                });
        }

        if (data.place === 'beforeOrderClose') {
            this.getCurrentClient()
                .then((info) => {
                    if (info.client && info.client.bonus > 0) {
                        this.setState({
                            currentClient: info.client,
                            currentOrder: info.order,
                            place: 'beforeOrderClose',
                        });

                        Poster.interface.popup({width: 500, height: 300, title: 'Списание бонусов'});
                    } else {
                        // Если не нашли клиента или у него нет бонусов, продолжаем поток выполнения в Poster
                        this.next();
                    }
                });
        }
    };

    render() {
        const {
            place, clientGroups, currentClient, currentOrder, templates, currentTemplateIdx
        } = this.state;

        // В зависимости от места в котором вызвали икно интеграции отображаем разные окна

        // Окно настроек
        if (place === 'functions') {
            return (
                <ConfigView
                    templates={templates}
                    currentTemplateIdx={currentTemplateIdx}
                    setTemplate={this.setTemplate}
                    getTemplate={this.getTemplate}
                    api={this.apiRequest}
                />
            );
        }

        // Окно заказа
        if (place === 'order') {
            return (
                <ClientView
                    groups={clientGroups}
                    currentClient={currentClient}
                    currentOrder={currentOrder}
                    api={this.apiRequest}
                    setClient={this.setClient}
                    addClient={this.addClient}
                    getTemplate={this.getTemplate}
                />
            );
        }

        // Окно списания бонусов перед закрытием заказа
        if (place === 'beforeOrderClose') {
            return (
                <BonusView
                    currentClient={currentClient}
                    currentOrder={currentOrder}
                    withdrawBonus={this.withdrawBonus}
                />
            );
        }

        return (<div/>);
    }

    /* ======================================== */

    getTemplate = () => {
        if (parseInt(this.state.currentTemplateIdx) >= 0) {
            return this.state.templates[parseInt(this.state.currentTemplateIdx)];
        }
        return null;
    };

    setTemplate = (templateIdx) => {
        if (parseInt(templateIdx) >= 0) {
            this.setState({currentTemplateIdx: parseInt(templateIdx)});
        }
    };
    /**
     *
     */
    getTemplates = () => {
        let self = this;
        this.apiRequest('gettemplates', {}, (answer) => {
            if (answer && Number(answer.code) === 200) {
                let _res = JSON.parse(answer.result);
                if (_res) {
                    // self.setTemplate(_res.result[0]);
                    self.setState({templates: _res.result});
                } else {
                    self.notify('Не найден ни один шаблон');
                }
            } else {
                self.notify('Ошибка обмена данными');
            }
        });
    };
    /* ======================================== */
    /**
     * привязывает клиента к заказу
     * @param client
     */
    setClient = (client) => {
        // if (!this.state.currentOrder) {
        //     let self = this;
        //     Poster.orders.getActive()
        //         .then(function (order) {
        //             self.setState({currentOrder: order});
        //             return Poster.orders.setOrderClient(this.state.currentOrder.id, client.id);
        //         });
        // } else {
        return Poster.orders.setOrderClient(this.state.currentOrder.id, client.id);
        // }
        // Привязали к текущему заказу

    };
    /**
     * добавляет клиента в постер
     * @param client
     * @returns {*}
     */
    addClient = (client) => {
        let self = this;
        return Poster.clients.create({client: client});
    };
    /**
     * Отправка запросов к апи сервиса
     * @param method
     * @param data
     * @param _cb
     * @returns {*}
     * пример
     this.apiRequest('gettemplates', {}, (answer) => {
            if (answer && Number(answer.code) === 200) {
                let _res = JSON.parse(answer.result);
                if (_res) {
                } else {
                    self.notify('404');
                }
            } else {
                self.notify('Ошибка обмена данными');
            }
        });
     */
    apiRequest = (method, data, _cb) => {
        if (typeof Poster.settings.extras.token !== 'string') {
            return alert('Не установлен токен доступа, сбросьте кеш терминала!');
        }
        // console.log('Send to: https://u-crd.ru/oapi/v1/' + method);
        // return Poster.makeRequest('https://u-crd.ru/poster/query', {
        // console.log({
        //     url: 'https://u-crd.ru/oapi/v1/' + method,
        //     headers: [
        //         'Content-Type: application/json',
        //         'Accept: application/json',
        //         'Authorization: atoken ' + Poster.settings.extras.token,
        //     ],
        //     method: 'post',
        //     data: data,
        //     dataType: "json",
        //     timeout: 10000,
        // });
        return Poster.makeRequest('https://u-crd.ru/oapi/v1/' + method, {
            headers: [
                'Content-Type: application/json',
                'Accept: application/json',
                'Authorization: atoken ' + Poster.settings.extras.token,
            ],
            method: 'post',
            data: data,
            dataType: "json",
            timeout: 10000,
        }, (answer) => _cb(answer));
    };
}
