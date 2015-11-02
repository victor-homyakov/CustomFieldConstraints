import React, {findDOMNode} from 'react';
import {compact, invoke} from 'underscore';
import $ from 'jquery';
import cx from 'classnames';

export default class InputMultidropdown extends React.Component {

    static defaultProps = {
        value: []
    }

    render() {

        const {field, value} = this.props;
        const options = compact(invoke(field.value.split(/\r?\n/), 'trim'));

        return (
            <select
                {...this.props}
                className={cx('tau-select', {'tau-error': this.props.isInvalid})}
                multiple={true}
                ref="input"
                type="text"
                value={value}
            >
                {options.map((v, k) => (
                    <option key={k} value={v}>{v}</option>
                ))}
            </select>
        );

    }

    get value() {

        return $(findDOMNode(this.refs.input)).val();

    }

}
