const Polari = imports.gi.Polari;
const Lang = imports.lang;
const Tp = imports.gi.TelepathyGLib;
const Signals = imports.signals;
const ChatroomManager = imports.chatroomManager;

/*left the old tracker here in order to compare the versions*/
/*const UserTracker = new Lang.Class({
    Name: 'UserTracker',

    _init: function(room) {
        this._referenceRoomSignals = [
            { name: 'notify::channel',
              handler: Lang.bind(this, this._onChannelChanged) },
            { name: 'member-renamed',
              handler: Lang.bind(this, this._onMemberRenamed) },
            { name: 'member-disconnected',
              handler: Lang.bind(this, this._onMemberDisconnected) },
            { name: 'member-kicked',
              handler: Lang.bind(this, this._onMemberKicked) },
            { name: 'member-banned',
              handler: Lang.bind(this, this._onMemberBanned) },
            { name: 'member-joined',
              handler: Lang.bind(this, this._onMemberJoined) },
            { name: 'member-left',
              handler: Lang.bind(this, this._onMemberLeft) }
        ];

        this._contactMapping = new Map();

        if (!room) {
            log("global user tracker created");
            this._chatroomManager = ChatroomManager.getDefault();

            this._chatroomManager.connect('room-added', Lang.bind(this, this._onRoomAdded));
            this._chatroomManager.connect('room-removed', Lang.bind(this, this._onRoomRemoved));
        } else {
            this._room = room;

            this._onRoomAdded(null, this._room);
            this._onChannelChanged(this._room);
        }
    },

    _onRoomAdded: function(roomManager , room) {
        this._roomSignals = [];
        this._referenceRoomSignals.forEach(Lang.bind(this, function(signal) {
            this._roomSignals.push(room.connect(signal.name, signal.handler));
        }));
    },

    _onRoomRemoved: function(roomManager, room) {
        for (let i = 0; i < this._roomSignals.length; i++)
            room.disconnect(this._roomSignals[i]);
        this._roomSignals = [];
    },

    _onChannelChanged: function(emittingRoom) {
        if (emittingRoom.channel) {
            let members;
            if (emittingRoom.type == Tp.HandleType.ROOM)
                members = emittingRoom.channel.group_dup_members_contacts();
            else
                members = [emittingRoom.channel.connection.self_contact, emittingRoom.channel.target_contact];

            members.forEach(m => {
                m._room = emittingRoom;
                this._trackMember(m);
            });
        } else {
            for ([baseNick, basenickContacts] of this._contactMapping) {
                basenickContacts.forEach(Lang.bind(this, function(member) {
                    if (member._room == emittingRoom)
                        this._untrackMember(member);
                }));

                this._contactMapping.delete(baseNick);
            }
        }
    },

    _onMemberRenamed: function(room, oldMember, newMember) {
        oldMember._room = room;
        newMember._room = room;
        this._untrackMember(oldMember);
        this._trackMember(newMember);
    },

    _onMemberDisconnected: function(room, member, message) {
        member._room = room;
        this._untrackMember(member);
    },

    _onMemberKicked: function(room, member, actor) {
        member._room = room;
        this._untrackMember(member);
    },

    _onMemberBanned: function(room, member, actor) {
        member._room = room;
        this._untrackMember(member);
    },

    _onMemberJoined: function(room, member) {
        member._room = room;
        this._trackMember(member);
    },

    _onMemberLeft: function(room, member, message) {
        member._room = room;
        this._untrackMember(member);
    },

    _trackMember: function(member) {
        let baseNick = Polari.util_get_basenick(member.alias);

        if (this._contactMapping.has(baseNick))
            this._contactMapping.get(baseNick).push(member);
        else
            this._contactMapping.set(baseNick, [member]);

        if (this._contactMapping.get(baseNick).length == 1)
            this.emit('status-changed', member.alias, Tp.ConnectionPresenceType.AVAILABLE);
    },

    _untrackMember: function(member) {
        let baseNick = Polari.util_get_basenick(member.alias);

        let contacts = this._contactMapping.get(baseNick) || [];
        let indexToDelete = contacts.map(c => c.alias).indexOf(member.alias);

        if (indexToDelete > -1) {
            contacts.splice(indexToDelete, 1);

            if (contacts.length == 0)
                this.emit('status-changed', member.alias, Tp.ConnectionPresenceType.OFFLINE);
        }
    },

    getNickStatus: function(nickName) {
        let baseNick = Polari.util_get_basenick(nickName);

        let contacts = this._contactMapping.get(baseNick) || [];
        return contacts.length == 0 ? Tp.ConnectionPresenceType.OFFLINE
                                    : Tp.ConnectionPresenceType.AVAILABLE;
    },
});*/

const UserTracker = new Lang.Class({
    Name: 'UserTracker',

    _init: function() {
        this._referenceRoomSignals = [
            { name: 'notify::channel',
              handler: Lang.bind(this, this._onChannelChanged) },
            { name: 'member-renamed',
              handler: Lang.bind(this, this._onMemberRenamed) },
            { name: 'member-disconnected',
              handler: Lang.bind(this, this._onMemberDisconnected) },
            { name: 'member-kicked',
              handler: Lang.bind(this, this._onMemberKicked) },
            { name: 'member-banned',
              handler: Lang.bind(this, this._onMemberBanned) },
            { name: 'member-joined',
              handler: Lang.bind(this, this._onMemberJoined) },
            { name: 'member-left',
              handler: Lang.bind(this, this._onMemberLeft) }
        ];

        this._globalContactMapping = new Map();
        this._roomMapping = new Map();

        this._chatroomManager = ChatroomManager.getDefault();
        this._chatroomManager.connect('room-added', Lang.bind(this, this._onRoomAdded));
        this._chatroomManager.connect('room-removed', Lang.bind(this, this._onRoomRemoved));
    },

    _onRoomAdded: function(roomManager, room) {
        this._connectRoomSignalsForRoom(room);
    },

    _onRoomRemoved: function(roomManager, room) {
        this._disconnectRoomSignalsForRoom(room);
    },

    _connectRoomSignalsForRoom: function(room) {
        if (!this._roomMapping.get(room))
            this._roomMapping.set(room, {});

        let roomData = this._roomMapping.get(room);

        roomData._roomSignals = [];
        this._referenceRoomSignals.forEach(Lang.bind(this, function(signal) {
            roomData._roomSignals.push(room.connect(signal.name, signal.handler));
        }));
    },

    _disconnectRoomSignalsForRoom: function(room) {
        let roomData = this._roomMapping.get(room);

        for (let i = 0; i < roomData._roomSignals.length; i++) {
            room.disconnect(roomData._roomSignals[i]);
        }
        roomData._roomSignals = [];
    },

    _onChannelChanged: function(emittingRoom) {
        if (emittingRoom.channel) {
            let members;
            if (emittingRoom.type == Tp.HandleType.ROOM)
                members = emittingRoom.channel.group_dup_members_contacts();
            else
                members = [emittingRoom.channel.connection.self_contact, emittingRoom.channel.target_contact];

            /*if there is no map keeping track of the users in the emittingRoom
            create it*/
            if (!this._roomMapping.get(emittingRoom)._contactMapping)
                this._roomMapping.get(emittingRoom)._contactMapping = new Map();

            /*keep track of initial members in the emittingRoom, both locally and
            globally*/
            members.forEach(m => {
                m._room = emittingRoom;
                this._trackMember(this._roomMapping.get(emittingRoom)._contactMapping, m);
                this._trackMember(this._globalContactMapping, m);
            });
        } else {
            /*handle the absence of a channel for the global case*/
            for ([baseNick, basenickContacts] of this._globalContactMapping) {
                basenickContacts.forEach(Lang.bind(this, function(member) {
                    if (member._room == emittingRoom)
                        /*safe to delete while iterating?*/
                        this._untrackMember(this._globalContactMapping, member);
                }));

                this._globalContactMapping.delete(baseNick);
            }
            /*handle the absence of a channel for the local case*/
            for ([baseNick, basenickContacts] of this._roomMapping.get(emittingRoom)._contactMapping) {
                basenickContacts.forEach(Lang.bind(this, function(member) {
                    if (member._room == emittingRoom)
                        /*safe to delete while iterating?*/
                        this._untrackMember(this._roomMapping.get(emittingRoom)._contactMapping, member);
                }));

                this._roomMapping.get(emittingRoom)._contactMapping.delete(baseNick);
            }
        }
    },

    _onMemberRenamed: function(room, oldMember, newMember) {
        oldMember._room = room;
        newMember._room = room;

        this._untrackMember(this._roomMapping.get(room)._contactMapping, oldMember);
        this._untrackMember(this._globalContactMapping, oldMember);
        this._trackMember(this._roomMapping.get(room)._contactMapping, newMember);
        this._trackMember(this._globalContactMapping, newMember);
    },

    _onMemberDisconnected: function(room, member, message) {
        member._room = room;

        this._untrackMember(this._roomMapping.get(room)._contactMapping, member);
        this._untrackMember(this._globalContactMapping, member);
    },

    _onMemberKicked: function(room, member, actor) {
        member._room = room;

        this._untrackMember(this._roomMapping.get(room)._contactMapping, member);
        this._untrackMember(this._globalContactMapping, member);
    },

    _onMemberBanned: function(room, member, actor) {
        member._room = room;

        this._untrackMember(this._roomMapping.get(room)._contactMapping, member);
        this._untrackMember(this._globalContactMapping, member);
    },

    _onMemberJoined: function(room, member) {
        member._room = room;

        this._trackMember(this._roomMapping.get(room)._contactMapping, member);
        this._trackMember(this._globalContactMapping, member);
    },

    _onMemberLeft: function(room, member, message) {
        member._room = room;

        this._untrackMember(this._roomMapping.get(room)._contactMapping, member);
        this._untrackMember(this._globalContactMapping, member);
    },

    _trackMember: function(map, member) {
        let baseNick = Polari.util_get_basenick(member.alias);

        if (map.has(baseNick))
            map.get(baseNick).push(member);
        else
            map.set(baseNick, [member]);

        if (map.get(baseNick).length == 1)
            if (map == this._globalContactMapping)
                log("[Global UserTracker] User " + member.alias + " is now globally available");
            else
                log("[Local UserTracker] User " + member.alias + " is now available in room " + member._room.channelName);
    },

    _untrackMember: function(map, member) {
        let baseNick = Polari.util_get_basenick(member.alias);

        let contacts = map.get(baseNick) || [];
        /*i really don;t like this search. maybe use a for loop?*/
        let indexToDelete = contacts.map(c => c.alias + "|" + c._room.channelName).indexOf(member.alias + "|" + member._room.channelName);

        if (indexToDelete > -1) {
            contacts.splice(indexToDelete, 1);

            if (contacts.length == 0)
                if (map == this._globalContactMapping)
                    log("[Global UserTracker] User " + member.alias + " is now globally offline");
                else
                    log("[Local UserTracker] User " + member.alias + " is now offline in room " + member._room.channelName);
        }
    },

    getNickGlobalStatus: function(nickName) {
        let baseNick = Polari.util_get_basenick(nickName);

        let contacts = this._globalContactMapping.get(baseNick) || [];
        return contacts.length == 0 ? Tp.ConnectionPresenceType.OFFLINE
                                    : Tp.ConnectionPresenceType.AVAILABLE;
    }
});
Signals.addSignalMethods(UserTracker.prototype);
