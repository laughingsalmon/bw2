import { BWItemSheet } from './bwItemSheet';

export class RelationshipSheet extends BWItemSheet {
    static get defaultOptions(): BaseEntitySheet.Options {
        return mergeObject(super.defaultOptions, {});
    }

    get template(): string {
        return 'systems/burningwheel/templates/items/relationship.hbs';
    }
}
