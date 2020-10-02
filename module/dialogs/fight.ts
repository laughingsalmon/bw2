import { BWItemData, MeleeWeaponRootData } from "../items/item.js";
import { NpcDataRoot } from "../npc.js";
import { BWActor, CharacterDataRoot } from "../bwactor.js";
import { StringIndexedObject } from "../helpers.js";
import { ExtendedTestData, ExtendedTestDialog } from "./extendedTestDialog.js";
import { handleFightRoll } from "../rolls/fightRoll.js";

export class FightDialog extends ExtendedTestDialog<FightDialogData> {
    constructor(d: DialogData, o?: ApplicationOptions) {
        super(d, o);
        this.data.data.participants = this.data.data.participants || [];
        this.data.data.participantIds = this.data.data.participantIds || [];
        this.data.actionOptions = options;
        this.data.actors = [];
        this.data.topic = "Fight";
        this.data.settingName = "fight-data";
    }

    getData(): FightDialogData {
        const data = super.getData();

        if (!this.data.actors.length) {
            this.data.actors = game.actors.filter((i: BWActor) => this.data.data.participantIds.includes(i.id)) || [];
        }

        const actors = game.actors.entities;
        data.gmView = game.user.isGM;
        data.participantOptions = actors
            .filter(a => !this.data.data.participantIds.includes(a._id))
            .map(a => {
            return { id: a._id, name: a.name };
        });

        data.participants.forEach(p => {
            const actor = this.data.actors.find(a => a.id === p.id) as BWActor;
            if (!actor) { return; }
            p.weapons = actor.data.fightWeapons.map(w => {
                if (w.type === "melee weapon") {
                    const mw = w as MeleeWeaponRootData;
                    return Object.values(mw.data.attacks).map((atk, index) => { 
                        return {
                            id: `${(mw as BWItemData & { _id:string })._id}_${index}`,
                            label: `${mw.name} ${atk.attackName}`
                        };
                    });
                }
                return [{
                    id: (w as BWItemData & { _id:string })._id,
                    label: w.name
                }];
            }).flat(1);

            p.showAction2 = !!p.action1;
            p.showAction3 = !!p.action2;

            p.showAction5 = !!p.action4;
            p.showAction6 = !!p.action5;

            p.showAction8 = !!p.action7;
            p.showAction9 = !!p.action8;

            p.showActions = (data.gmView && !p.gmHidden) || (!data.gmView && this.data.actors.find(a => a.id === p.id)?.owner);
        });
        data.actionOptions = this.data.actionOptions;
        return data;
    }

    activateListeners(html: JQuery): void {
        super.activateListeners(html);
        html.on('submit', (e) => { e.preventDefault(); });

        html.find('button[data-action="clearAll"]').on('click', e => {
            e.preventDefault();
            this.data.data.participants = [];
            this.data.data.participantIds = [];
            this.data.data.showV1 = this.data.data.showV2 = this.data.data.showV3 = false;
            this.syncData(this.data.data);
            this.persistState(this.data.data);
            this.render();
        });

        html.find('button[data-action="resetRound"]').on('click', e => {
            e.preventDefault();
            this.data.data.participants.forEach(p => {
                p.action1 = p.action2 = p.action3 = p.action4 = p.action5
                = p.action6 = p.action7 = p.action8 = p.action9 = "";
            });
            this.data.data.showV1 = this.data.data.showV2 = this.data.data.showV3 = false;
            this.syncData(this.data.data);
            this.persistState(this.data.data);
            this.render();
        });

        html.find('input[name="showV1"], input[name="showV2"], input[name="showV3"]').on('change', (e: JQuery.ChangeEvent) => this.propagateChange(e));
        html.find('select[name="newParticipant"]').on('change', (e: JQuery.ChangeEvent) => this._addNewParticipant(e.target));
        html.find('*[data-action="removeFighter"]').on('click', (e: JQuery.ClickEvent) => {
            e.preventDefault();
            this._removeParticipant(e.target);
        });
        html.find('*[data-action="toggleHidden"').on('click', (e: JQuery.ClickEvent) => {
            e.preventDefault();
            this._toggleHidden(e.target);
        });
        html.find('.fighters-grid input, .fighters-grid select').on('change', (e: JQuery.ChangeEvent) => {
            e.preventDefault();
            this._updateGridData(e);
        });

        html.find('button[data-action="rollSpeed"]').on('click', (e: JQuery.ClickEvent) => { this._handleRoll(e, "speed"); });
        html.find('button[data-action="rollPower"]').on('click', (e: JQuery.ClickEvent) => { this._handleRoll(e, "power"); });
        html.find('button[data-action="rollAgility"]').on('click', (e: JQuery.ClickEvent) => { this._handleRoll(e, "agility"); });
        html.find('button[data-action="rollSkill"]').on('click', (e: JQuery.ClickEvent) => { this._handleRoll(e, "skill"); });

        html.find('img[data-action="openSheet"]').on('click', (e: JQuery.ClickEvent) => {
            const id = e.target.dataset.actorId || "";
            game.actors.find(a => a._id === id).sheet.render(true);
        });
    }
    private _handleRoll(e: JQuery.ClickEvent, type: "speed" | "agility" | "power" | "skill") {
        e.preventDefault();
        const index = parseInt(e.target.dataset.index || "0");
        const actor = this.data.actors[index];
        const engagementBonus = parseInt(this.data.data.participants[index].engagementBonus.toString());
        const positionPenalty = parseInt(this.data.data.participants[index].positionPenalty.toString());
        if (type === "skill") {
            let itemIdString = this.data.data.participants[index].weaponId;
            let attackIndex: number | undefined;
            if (itemIdString.indexOf('_') !== -1) {
                attackIndex = parseInt(itemIdString.substr(itemIdString.indexOf('_')+1));
                itemIdString = itemIdString.substr(0, itemIdString.indexOf('_'));
            }
            return handleFightRoll({ actor, type, itemId: itemIdString, attackIndex, engagementBonus, positionPenalty });
        }
        return handleFightRoll({ actor, type, engagementBonus, positionPenalty });
    }

    private _updateGridData(e: JQuery.ChangeEvent): void {
        const index = parseInt(e.target.dataset.index || "0");
        const newValue = e.target.type ==="checkbox" ? e.target.checked : e.target.value;
        const dataPath = e.target.name;

        this.data.data.participants[index][dataPath] = newValue;

        this.persistState(this.data.data);
        this.syncData(this.data.data);
        this.render();
    }
    
    private _toggleHidden(target: HTMLDivElement): void {
        if (!game.user.isGM) { return; }
        const index = parseInt(target.dataset.index || "0") ;
        const hidden = this.data.data.participants[index].gmHidden;
        this.data.data.participants[index].gmHidden = !hidden;
        this.persistState(this.data.data);
        this.syncData(this.data.data);
        this.render(true);
    }
    private _addNewParticipant(target: HTMLSelectElement): void {
        const id = target.value;
        const actor = game.actors.get(id) as BWActor;
        this.data.actors.push(actor);
        this.data.data.participants.push({ ...toParticipantData(actor),
            action1: '', action2: '', action3: '', action4: '', action5: '',
            action6: '', action7: '', action8: '', action9: '', gmHidden: false,
            engagementBonus: 0, positionPenalty: 0
        } as ParticipantEntry);
        this.data.data.participantIds.push(id);
        this.persistState(this.data.data);
        this.syncData(this.data.data);
        this._syncActors();
        this.render();
    }

    private _removeParticipant(target: HTMLElement): void {
        const index = parseInt(target.dataset.index || "0");
        this.data.data.participantIds.splice(index, 1);
        this.data.data.participants.splice(index, 1);
        this.persistState(this.data.data);
        this.syncData(this.data.data);
        this._syncActors();
        this.render();
    }

    activateSocketListeners(): void {
        super.activateSocketListeners();
        game.socket.on("system.burningwheel", ({type}) => {
            if (type === `syncActors${this.data.topic}`) {
                this.data.actors = game.actors.filter((i: BWActor) => this.data.data.participantIds.includes(i.id)) || [];
                this.render();
            }
        });
    }

    private _syncActors() {
        game.socket.emit("system.burningwheel", { type: `syncActors${this.data.topic}`});
    }

    data: ExtendedTestData<FightDialogData> & {
        actionOptions: StringIndexedObject<string[]>;
        actors: BWActor[];
    };

    get template(): string {
        return "systems/burningwheel/templates/dialogs/fight.hbs";
    }

    static get defaultOptions(): FormApplicationOptions {
        return mergeObject(super.defaultOptions, {
            width: 1000,
            height: 600,
            resizable: true,
            classes: [ "fight" ]
        }, { overwrite: true });
    }

    static addSidebarControl(html: JQuery): void {
        const buttonElement = document.createElement("button");
        buttonElement.textContent = "Fight";
        buttonElement.className = "fight-sidebar-button";
        buttonElement.onclick = () => game.burningwheel.fight.render(true);
        const combatHeader = $(html).find("header");
        combatHeader.prepend(buttonElement);
    }
}

function toParticipantData(actor: BWActor): Partial<ParticipantEntry> {
    const reflexesString = `${actor.data.data.reflexesShade}${
        (actor.data.type === "character" ?
        (actor.data as CharacterDataRoot).data.reflexesExp :
        (actor.data as NpcDataRoot).data.reflexes)}`;
    return {
        name: actor.name,
        id: actor._id,
        imgSrc: actor.img,
        reflexes: reflexesString,
    };
}

export interface FightDialogData {
    actionOptions: StringIndexedObject<string[]>;
    participantOptions: { id: string, name: string }[];
    participantIds: string[];
    gmView: boolean;
    participants: ParticipantEntry[];
    showV1: boolean;
    showV2: boolean;
    showV3: boolean;
}

interface ParticipantEntry {
    showAction3: boolean;
    showAction2: boolean;
    showAction5: boolean;
    showAction6: boolean;
    showAction8: boolean;
    showAction9: boolean;

    id: string;
    name: string;
    reflexes: string;

    gmHidden: boolean;
    showActions?: boolean;
    
    weaponId: string;
    engagementBonus: number;
    positionPenalty: number;

    imgSrc: string;
    action1: string;
    action2: string;
    action3: string;
    action4: string;
    action5: string;
    action6: string;
    action7: string;
    action8: string;
    action9: string;
    weapons?: { id: string, label: string }[];
}

const options = {
    "Attack Actions": [
        "Strike", "Great Strike", "Block and Strike", "Lock and Strike"
    ],
    "Defense Actions": [
        "Avoid", "Block", "Counter&shy;strike"
    ],
    "Basic Actions": [
        "Assess", "Change Stance", "Charge/&shy;Tackle", "Draw Weapon", "Physical Action", "Push", "Lock", "Get Up", "Disarm", "Feint", "Throw Person"
    ],
    "Shooting Actions": [
        "Throw Object/&shy;Weapon", "Aim", "Nock and Draw", "Reload", "Fire", "Release Bow", "Snapshot"
    ],
    "Magic Actions": [
        "Cast a Spell", "Drop Spell", "Command Spirit"
    ],
    "Social Actions": [
        "Command", "Intimidate"
    ],
    "Hesitation Actions": [
        "Fall Prone", "Run Screaming", "Stand & Drool", "Swoon"
    ]
};