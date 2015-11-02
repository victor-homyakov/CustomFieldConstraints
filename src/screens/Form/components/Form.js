import React, {PropTypes as T} from 'react';

import FormRow from './FormRow';
import {buttons} from './Form.css';

export default class Form extends React.Component {

    static propTypes = {
        fields: T.arrayOf(FormRow.propTypes.item),
        showProgress: T.bool,
        values: T.object
    }

    static defaultProps = {
        fields: [],
        values: {}
    }

    render() {

        const {fields, showProgress} = this.props;
        const hasInvalid = fields.some(({validationErrors}) => validationErrors.length);

        return (
            <form onSubmit={this.handleSubmit}>
                {fields.map((field) => (
                    <FormRow
                        item={field}
                        key={field.name}
                        onChange={this.handleChange}
                        ref={field.name}
                    />
                ))}
                <div className={buttons}>
                    <button
                        className="tau-btn tau-primary"
                        disabled={hasInvalid || showProgress || null}
                        type="submit"
                    >
                        {'Save and Continue'}
                    </button>
                </div>
            </form>
        );

    }

    handleSubmit = (e) => {

        e.preventDefault();

        const values = this.props.fields.map((field) => ({
            ...field,
            value: this.refs[field.name].value
        }));

        this.props.onSubmit(values);

    }

    handleChange = (field, value) => {

        this.props.onChange(field, value);

    }

}
