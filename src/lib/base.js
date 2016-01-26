import {when, Deferred} from 'jquery';
import {getEntityTypesNamesFromConfig} from 'utils';

const processRequirements = (requirements, next, resolve, reject) => {

    const all = requirements.reduce((res, requirement) => {

        return res.then(() => {

            const def = new Deferred();

            next(requirement, def);

            return def.promise();

        });

    }, when(true));

    when(all).then(resolve, reject);

};

export const createInterrupter = ({systemInterrupter, getEntitiesFromChanges}) =>
    (config, next) => {

        const entityTypesNamesToInterrupt = getEntityTypesNamesFromConfig(config);

        entityTypesNamesToInterrupt.forEach((entityTypeName) => {

            systemInterrupter.interruptSave(entityTypeName, (def, changes) => {

                const resolve = def.resolve;
                const reject = def.reject;

                const entitiesFromChanges = changes
                .filter((v) => v.id);

                if (!entitiesFromChanges.length) {

                    resolve();
                    return;

                }

                when(getEntitiesFromChanges(entitiesFromChanges))
                .then((requirements) => requirements.filter((v) => v && v.axes.length)) // eslint-disable-line
                .then((requirements) => processRequirements(requirements, next, resolve, reject))
                .fail(() => resolve());

            });

        });

    };

export const createFullChanges = (entitiesFromChanges) =>
    entitiesFromChanges.map((smallEntity) => ({
        entity: {},
        to: smallEntity,
        processId: null
    }));
