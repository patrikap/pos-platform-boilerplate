/**
 * Отображает и создает новых клиентов
 * **/
export default class OrderView extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            clientCode: '0000000000003',
            status: '',
        };
        Poster.on('afterPopupClosed', () => {
            this.setState({status: null});
        });
    }

    notify = (msg) => {
        Poster.interface.showNotification({
            title: Poster.settings.applicationName.toUpperCase(),
            message: msg,
            icon: 'https://dev.joinposter.com/public/apps/ucard/icon.png',
        });
    };

    scanQR = () => {
        let self = this;
        Poster.interface.scanBarcode()
            .then(function (barcode) {
                // self.setState({status: JSON.stringify(barcode)});
                self.setState({clientCode: barcode.barcode});
                self.getClient();
            });
    };

    updateInput = (e) => {
        let {id, value} = e.target;
        this.setState({[id]: value});
    };

    getClient = () => {
        let self = this;
        if (self.state.clientCode) {
            Poster.clients.find({
                searchVal: this.state.clientCode
            }).then(function (result) {
                if (result.foundByCard.length > 0) {
                    self.setState({status: 'Клиент найден в базе.'});
                    let client = result.foundByCard[0];
                    self.props.setClient(client).then(() => {
                        self.notify('Карта ' + self.state.clientCode + ' применена');
                        Poster.interface.closePopup();
                        self.setState({status: null});
                        // получить группы для разделения по уровням
                        // обновить клиента на сервисе U-CARD
                        self.props.api('upsert', {
                            templateId: self.props.getTemplate().templateId,
                            cardCode: self.state.clientCode,
                            values: {
                                CARD_CODE: client.cardNumber,
                                HOLDER: client.firstname + ' ' + client.lastname,
                                DISCOUNT: client.discount,
                                BALANCE: client.bonus,
                                BIRTHDAY: client.birthday,
                                // '_PHONE': client.phone,
                                // '_EMAIL': client.email,
                                // LEVEL: client.email
                            },
                        }, (answer) => {
                            console.log(answer);
                            // отобразить QR код для нового или обновлённого клиента
                        });
                    });
                } else {
                    self.setState({status: 'Клиент не найден, ищем в U-CARD...'});
                    // запрос к юкард
                    self.searchCard();
                }
            });
        }
    };

    searchCard = () => {
        let self = this;
        self.props.api('getcard', {
            templateId: self.props.getTemplate().templateId,
            cardCode: self.state.clientCode,
        }, (answer) => {
            if (answer && Number(answer.code) === 200) {
                let _ans = JSON.parse(answer.result);
                if (_ans.result) {
                    let _res = _ans.result;
                    try {
                        var ph = _res.values._PHONE;
                        if (ph.length > 10) {
                            ph = ph.substr(ph.length - 10);
                        }
                    } catch (e) {
                        console.log(_res.values);
                        console.log(e);
                    }
                    self.setState({status: 'Создаётся клиент в базе'});
                    self.setCard({
                        "client_name": _res.values.HOLDER,
                        "client_groups_id_client": self.props.groups[0].client_groups_id,
                        "client_sex": parseInt(_res.values.GENDER),
                        "country_phone_code": 7,
                        "phone": ph,
                        "email": _res.values._EMAIL,
                        "card_number": self.state.clientCode,
                        "discount": parseInt(_res.values.DISCOUNT),
                        "bonus": parseInt(_res.values.BALANCE),
                        "city": "",
                        "address": "",
                        "country": "Россия",
                        "comment": 'электронная карта',
                        "birthday": _res.values.BIRTHDAY,
                        "extras": {
                            "cardInfo": _res,
                        },
                    }, 0);
                } else {
                    // console.log(_ans);
                    self.setState({status: 'Клиент не найден.'});
                    // self.notify('Клиент не найден');
                }
            } else if (Number(answer.code) === 404) {
                self.setState({status: 'Карта не найдена.'});
                // self.notify('Карта не найдена');
            } else {
                // console.log(answer);
                self.setState({status: 'Ошибка обмена данными.'});
                // self.notify('Ошибка обмена данными');
            }
        });
    };

    setCard = (in_client, stage) => {
        let self = this;
        self.props.addClient(in_client)
            .then(function (client) {
                if (client.error) {
                    if (stage === 0) {
                        in_client.comment = in_client.comment + "\n Телефон-дубликат: " + in_client.phone;
                        in_client.phone = null;
                        stage++;
                        self.setCard(in_client, stage);
                    } else {
                        console.error(client.error);
                        self.props.api('log', client.error);
                    }
                } else {
                    self.props.setClient(client);
                    self.notify('Карта' + in_client.card_number + ' добавлена');
                    Poster.interface.closePopup();
                    self.setState({status: null});
                }
            })
            .catch((err) => {
                console.error(err);
                // self.props.api('log', err, (_res) => {
                // });
            });
    };

    render() {
        // let {clientCode, clientPhone, selectedGroup, client} = this.state;
        let {clientCode} = this.state;
        let {currentClient} = this.props;
        // Если клиент привязан то показываем его бонусы по нему
        // Иначе даем возможность создать клиента и добавить заказа
        if (currentClient) {
            return (
                <div className="row">
                    <div className="col-xs-4"><b>Номер карты</b></div>
                    <div className="col-xs-8"><p>{currentClient.cardNumber || '—'}</p></div>

                    <div className="col-xs-4"><b>Имя</b></div>
                    <div className="col-xs-8"><p>{currentClient.firstname} {currentClient.lastname}</p></div>

                    <div className="col-xs-4"><b>Номер телефона</b></div>
                    <div className="col-xs-8"><p>{currentClient.phone || '-'}</p></div>

                    <div className="col-xs-4"><b>Email</b></div>
                    <div className="col-xs-8"><p>{currentClient.email || '-'}</p></div>

                    <div className="col-xs-4"><b>Сумма покупок</b></div>
                    <div className="col-xs-8"><p>{currentClient.totalPayedSum || 0} {Poster.settings.currency}</p></div>

                    <div className="col-xs-4"><b>Скидка</b></div>
                    <div className="col-xs-8"><p>{currentClient.discount || 0} %</p></div>

                    <div className="col-xs-4"><b>Бонус</b></div>
                    <div className="col-xs-8"><p>{currentClient.bonus || 0} {Poster.settings.currency}</p></div>

                    <div className="col-xs-4"><b>Комментарий</b></div>
                    <div className="col-xs-8"><p>{currentClient.comment || '-'}</p></div>
                </div>
            );
        } else {
            return (
                <form>
                    {/** using hidden input for IOS 9 input focus and onChange fix **/}
                    <input type="hidden"/>
                    <div className="row" style={{marginBottom: 10}}>
                        <div className="col-xs-12">
                            <button type="button" className="btn btn-block btn-primary btn-lg" onClick={this.scanQR}>
                                Сканировать QR
                            </button>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-xs-4">
                            <label htmlFor="code btn btn-default" style={{marginTop: 10}}>Номер карты</label>
                        </div>
                        <div className="col-xs-8">
                            <div className="input-group-lg">
                                <input className="form-control" type="text" placeholder="0000000090210" id="clientCode"
                                       onChange={this.updateInput} value={clientCode}/>
                            </div>
                        </div>
                    </div>
                    {this.state.status &&
                    <div className="row" style={{marginTop: 10}}>
                        <div className="col-xs-4">
                            <label htmlFor="code btn btn-default">Сообщение</label>
                        </div>
                        <div className="col-xs-8" style={{color: 'red'}}>
                            {this.state.status}
                        </div>
                    </div>
                    }
                    <div className="footer">
                        <div className="row">
                            <div className="col-xs-12">
                                <button className="btn btn-lg btn-block btn-info" type="button"
                                        onClick={this.getClient}>Найти
                                    клиента
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            );
        }
    }
}
