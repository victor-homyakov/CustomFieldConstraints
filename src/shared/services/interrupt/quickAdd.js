import $, {when, Deferred, whenList} from 'jquery';
import {find, object, flatten, compose, constant, unique, map, last, without, memoize} from 'underscore';

import {addBusListener} from 'targetprocess-mashup-helper/lib/events';

import decodeSliceValue from 'utils/decodeSliceValue';
import {inValues, equalIgnoreCase, isAssignable, SLICE_CUSTOMFIELD_PREFIX} from 'utils';

import store from 'services/store';

import {getCustomFieldsForAxes} from 'services/axes';

const loadProject = (projectId) =>
    store.get('Projects', projectId, {
        include: ['Process']
    });

const onRender = (configurator, componentBusName, cb) => {

    const afterRenderHandler = function(e) {

        const element = e.data.element;
        const componentBus = this; // eslint-disable-line no-invalid-this, consistent-this

        cb(element, componentBus);

    };

    configurator.getComponentBusRegistry().getByName(componentBusName).then((bus) => {

        bus.on('afterRender', afterRenderHandler, null, null, 9999);

    });

};

const createTemplateItemFromCustomField = (customField) => ({
    type: 'CustomField',
    config: customField.config,
    caption: customField.name,
    fieldType: customField.fieldType,
    processId: customField.process ? customField.process.id : null,
    required: true,
    options: {
        ...customField
    }
});

const events = ['afterInit:last', 'before_dataBind'];

const onDataBind = (componentBusName, cb) =>
    addBusListener(componentBusName, events.join(' + '), (e) => {

        e.before_dataBind.suspendMain();

        const initData = e.afterInit.data;
        const bindData = e.before_dataBind.data;
        const settingsData = e['settings.ready'] ? e['settings.ready'].data : void 0;

        const next = (customFields = []) => {

            customFields.forEach((v) => bindData.types[v.entityType.name].template.items.push(createTemplateItemFromCustomField(v)));
            e.before_dataBind.resumeMain();

        };
        const configurator = initData.config.context.configurator;

        cb(next, configurator, initData, bindData, settingsData);

    });

const getSliceDefinition = ({config}) =>
    (config.options && config.options.slice) ? config.options.slice.config.definition : null;

const getTargetValue = ({config}, axisName) =>
    decodeSliceValue(config.options.action ? config.options.action[axisName] : last(config.options.path));

const getEntityTypes = (initData, bindData) => {

    if (bindData.types) {

        return map(bindData.types, (v) => ({
            name: v.entityType.name
        }));

    } else if (initData.addAction) {

        return initData.addAction.data.types.map((v) => ({
            name: v.name
        }));

    } else {

        const sliceDefinition = getSliceDefinition(initData);

        if (sliceDefinition) {

            return sliceDefinition.cells.types.map((v) => ({
                name: v.type
            }));

        }

    }

    return [];

};

const getAxes = (initData, entityType) => {

    const defaultAssignableAxes = [{
        type: 'entitystate',
        targetValue: '_Initial'
    }];

    const sliceDefinition = getSliceDefinition(initData);

    const axes = ['x', 'y'].reduce((res, axisName) => {

        const axisDefinition = sliceDefinition ? sliceDefinition[axisName] : null;

        if (!axisDefinition) return res;

        if (inValues(axisDefinition.types, 'entitystate')) {

            return res.concat({
                type: 'entitystate',
                targetValue: getTargetValue(initData, axisName)
            });

        }

        // to get process if one of axis is project
        if (inValues(axisDefinition.types, 'project')) {

            return res.concat({
                type: 'project',
                targetValue: getTargetValue(initData, axisName)
            });

        }

        const customFieldName = find(axisDefinition.types, (v) => v.match(SLICE_CUSTOMFIELD_PREFIX));

        if (customFieldName) {

            return res.concat({
                type: 'customfield',
                customFieldName: customFieldName.replace(SLICE_CUSTOMFIELD_PREFIX, ''),
                targetValue: getTargetValue(initData, axisName)
            });

        }

        return res;

    }, []);

    if (isAssignable({entityType})) return unique(axes.concat(defaultAssignableAxes), (v) => v.type);
    else return axes;

};

const getApplicationContext = (configurator, params) => {

    const contextService = configurator.getApplicationContextService();
    const def = new Deferred();

    contextService.getApplicationContext(params, {success: def.resolve});

    return def.promise();

};

const getProcesses = (configurator) => {

    const applicationStore = configurator.getAppStateStore();

    return when(applicationStore.get({fields: ['acid']}))
        .then(({acid}) => getApplicationContext(configurator, {acid}))
        .then(({processes}) => processes);

};

const findCustomFieldElByName = ($el, name) => $el.find(`[data-iscf=true][data-fieldname=${name}]`);
const hideCustomFieldEl = ($cfEl) => {

    $cfEl.parent().removeClass('show');
    $cfEl.parent().addClass('hide');
    $cfEl.parent().find('input, select').toArray().forEach((v) =>
        $(v).data('validate').rules = without($(v).data('validate').rules, 'required'));

};

const showCustomFieldEl = ($cfEl) => {

    $cfEl.parent().addClass('show');
    $cfEl.parent().removeClass('hide');
    $cfEl.parent().find('input, select').toArray().forEach((v) =>
        $(v).data('validate').rules = $(v).data('validate').rules.concat('required'));

};

const applyActualCustomFields = ($el, allCustomFields, actualCustomFields) => {

    allCustomFields.forEach((v) => hideCustomFieldEl(findCustomFieldElByName($el, v.name)));
    actualCustomFields.forEach((v) => showCustomFieldEl(findCustomFieldElByName($el, v.name)));

};

const collectValues = ($el, customFields) =>
    object(customFields.map((v) => [v.name, findCustomFieldElByName($el, v.name).val()]));

const findFormByEntityType = ($el, entityType) =>
    $($el.find('.tau-control-set').toArray().filter((v) => equalIgnoreCase($(v).data('type'), entityType.name)));

const onCustomFieldsChange = ($el, customFields, handler) =>
    customFields.map((v) => findCustomFieldElByName($el, v.name).on('change, input', compose(handler, constant(void 0))));

const getProcessValue = ($el) => {

    const $select = $el.find('.project');

    if (!$select.length) return null;

    const value = $select.val();
    const processId = parseInt($select.children().filter(`[value=${value}]`).data('option').processId, 10);

    return {id: processId};

};

const onProcessChange = ($el, handler) =>
    $el.find('.project').on('change, input', () => {

        setTimeout(() => handler(getProcessValue($el)), 1);

    });

const listenQuickAddComponentBusForEntityType = (configurator, busName, config, axes, processes, entityType, onFieldsReady) => {

    let allCustomFields = [];
    let activeCustomFields = [];
    let actualValues = {};

    onRender(configurator, busName, ($elCommon, componentBus) => {

        const $el = findFormByEntityType($elCommon, entityType);
        const adjust = () => componentBus.fire('adjustPosition');

        const getActiveProcess = memoize(() => {

            const val = getProcessValue($el);

            if (val !== null) return val;

            const projectAxis = find(axes, (v) => v.type === 'project');

            if (!projectAxis) return null;

            return when(loadProject(projectAxis.targetValue))
                .then((project) => project.process)
                .fail(() => null);

        });

        const handler = (actualProcess, values = {}) => {

            if (!actualProcess) {

                return when(applyActualCustomFields($el, allCustomFields, []))
                    .then(adjust);

            }

            return when(getCustomFieldsForAxes(config, axes, [actualProcess], {entityType}, values, {skipValuesCheck: false}))
                .then((customFieldsToShow) => {

                    activeCustomFields = customFieldsToShow;
                    applyActualCustomFields($el, allCustomFields, activeCustomFields);

                })
                .then(adjust);

        };

        setTimeout(() =>
            when(getActiveProcess())
                .then(handler), 1); // some quick add magic

        onCustomFieldsChange($el, allCustomFields, () => {

            actualValues = collectValues($el, activeCustomFields);
            when(getActiveProcess())
                .then((process) => handler(process, actualValues));

        });

        onProcessChange($el, (processData) => handler([processData], actualValues));

    });

    when(getCustomFieldsForAxes(config, axes, processes, {entityType}, {}, {skipValuesCheck: true}))
    .then((customFields) => {

        allCustomFields = customFields;

    })
    .then(() => onFieldsReady(allCustomFields))
    .fail(() => onFieldsReady([]));

};

const applyToComponent = (config, {busName}) =>
    onDataBind(busName, (next, configurator, initData, bindData) => {

        getCustomFieldsForAxes.resetCache();

        const entityTypes = getEntityTypes(initData, bindData);

        when(getProcesses(configurator))
        .then((processes) =>
            whenList(entityTypes.map((entityType) => {

                const def = new Deferred();

                const axes = getAxes(initData, entityType);

                if (axes.length) listenQuickAddComponentBusForEntityType(configurator, busName, config, axes, processes, entityType, def.resolve);
                else def.resolve([]);

                return def.promise();

            }))
            .then((...args) => next(flatten(args))))
        .fail(() => next());

    });

export default (mashupConfig) => {

    const topLeftAddButtonComponentBusName = 'board plus quick add general';

    const viewBoardAndOnebyoneAndTimelineButtonInsideCellComponentBusName = 'board plus quick add cells';
    const viewBoardAndTimelineButtonInsideAxesComponentBusName = 'board axis quick add';

    const viewListButtonComponentBusName = 'board.cell.quick.add';

    const relationsTabComponentBusName = 'relations-quick-add-general';

    const entityTabsQuickAddBusName = 'entity quick add';

    const componentsConfig = [
        {
            busName: topLeftAddButtonComponentBusName
        },
        {
            busName: viewBoardAndOnebyoneAndTimelineButtonInsideCellComponentBusName
        },
        {
            busName: viewBoardAndTimelineButtonInsideAxesComponentBusName
        },

        {
            busName: viewListButtonComponentBusName
        },

        {
            busName: relationsTabComponentBusName
        },
        {
            busName: entityTabsQuickAddBusName
        }
    ];

    componentsConfig.forEach((componentConfig) => {

        applyToComponent(mashupConfig, componentConfig);

    });

};