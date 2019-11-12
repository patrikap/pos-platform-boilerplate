/**
 * Окно настроек приложения
 */
export default class ConfigView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {value: props.currentTemplateIdx};

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleChange(event) {
        this.props.setTemplate(event.target.value);
        event.preventDefault();
    }

    handleSubmit(event) {
        event.preventDefault();
        Poster.interface.closePopup();
    }

    render() {
        return (
            <form onSubmit={this.handleSubmit}>
                {/** using hidden input for IOS 9 input focus and onChange fix **/}
                <input type="hidden"/>

                <div className="row">
                    <div className="col-xs-4">
                        Выберите шаблон
                    </div>
                    <div className="col-xs-8">
                        <select value={this.props.currentTemplateIdx} onChange={this.handleChange}>
                            <option value="null">Выберите шаблон</option>
                            {Object.keys(this.props.templates).map((k) => <option
                                value={k}>{this.props.templates[k].userTitle}</option>)}
                        </select>
                    </div>
                </div>
                <div className="row" style={{marginBottom: 10, marginTop: 10}}>
                    <div className="col-xs-12 text-center">
                        Текущий шаблон
                    </div>
                </div>
                <div className="row">
                    <div className="col-xs-6">
                        Название
                    </div>
                    <div className="col-xs-6">
                        {this.props.getTemplate().userTitle}
                    </div>
                </div>
                <div className="row">
                    <div className="col-xs-6">
                        Тип
                    </div>
                    <div className="col-xs-6">
                        {this.props.getTemplate().type}
                    </div>
                </div>
                <div className="row">
                    <div className="col-xs-6">
                        Количество карт
                    </div>
                    <div className="col-xs-6">
                        {this.props.getTemplate().cardsCount}
                    </div>
                </div>
                {this.props.getTemplate().qrUrl &&
                <div className="row">
                    <div className="col-xs-6">
                        QR-код
                    </div>
                    <div className="col-xs-6">
                        <img src={this.props.getTemplate().qrUrl} alt="" width="120px" height="120px"/>
                    </div>
                </div>
                }
                <div className="footer">
                    <div className="row text-center">
                        <div className="col-xs-12 text-center">
                            <button className="btn btn-block btn-lg btn-success" type="submit">Сохранить</button>
                        </div>
                    </div>
                </div>
            </form>
        )
    }
}