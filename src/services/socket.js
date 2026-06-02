// src/services/socket.js
// Singleton socket shared across the entire app
// Prevents multiple sockets competing and notifications getting lost

import { io } from "socket.io-client";

let _socket = null;
let _userId = null;
let _teamId = null;

export function getAppSocket() {
  if (!_socket || _socket.disconnected) {
    _socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return _socket;
}

export function initUserSocket(userId) {
  if (_userId === userId) return getAppSocket(); // already joined
  _userId = userId;
  const sock = getAppSocket();
  const doJoin = () => {
    sock.emit("join_user_room", { userId });
  };
  if (sock.connected) doJoin();
  else sock.on("connect", doJoin);
  return sock;
}

export function joinTeamRoom(teamId) {
  if (_teamId === teamId) return;
  const sock = getAppSocket();
  if (_teamId) sock.emit("leave_team_room", { teamId: _teamId });
  _teamId = teamId;
  const doJoin = () => sock.emit("join_team_room", { teamId });
  if (sock.connected) doJoin();
  else sock.on("connect", doJoin);
}

export function leaveTeamRoom(teamId) {
  const sock = getAppSocket();
  sock.emit("leave_team_room", { teamId });
  if (_teamId === teamId) _teamId = null;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
    _userId = null;
    _teamId = null;
  }
}
