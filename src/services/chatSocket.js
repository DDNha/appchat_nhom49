const WS_URL = import.meta.env.VITE_WS_URL;

const KEY_USER = "user";
const KEY_CODE = "RE_LOGIN_CODE";

class ChatSocket {
    constructor() {
        this.ws = null;
        this.listeners = new Map();
        this.queue = [];
        this.authed = false;
        this.pendingUser = null;
    }
    connect() {
        const s = this.ws?.readyState;
        if (s === WebSocket.OPEN || s === WebSocket.CONNECTING) return;

        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
            // Tự đăng nhập lại bằng mã đã lưu (phiên giữ trong 2 tiếng)
            const user = localStorage.getItem(KEY_USER);
            const code = localStorage.getItem(KEY_CODE);
            if (user && code) this.rawSend("RE_LOGIN", { user, code });

            this.queue.forEach((m) => this.ws.send(m));
            this.queue = [];
            this.emit("__open");
        };

        this.ws.onmessage = (e) => {
            let msg;
            try {
                msg = JSON.parse(e.data);
            } catch {
                return;
            }
            this.handleInternal(msg);
            this.emit(msg.event, msg);
        };

        this.ws.onclose = () => {
            this.authed = false;
            this.emit("__close");
            setTimeout(() => this.connect(), 3000);
        };
    }
    // Xử lý đăng nhập
    handleInternal(msg) {
        const ok = msg.status === "success";

        if (msg.event === "LOGIN" && ok) {
            if (this.pendingUser) localStorage.setItem(KEY_USER, this.pendingUser);
            localStorage.setItem(KEY_CODE, msg.data.RE_LOGIN_CODE);
            this.authed = true;
            this.emit("__authed");
        }

        if (msg.event === "RE_LOGIN") {
            if (ok) {
                localStorage.setItem(KEY_CODE, msg.data.RE_LOGIN_CODE);
                this.authed = true;
                this.emit("__authed");
            } else {
                this.clearSession();
                this.emit("__session_expired");
            }
        }

        if (msg.event === "LOGOUT" && ok) {
            this.clearSession();
        }
    }

    clearSession() {
        this.authed = false;
        this.pendingUser = null;
        localStorage.removeItem(KEY_USER);
        localStorage.removeItem(KEY_CODE);
    }

    //gửi/ nhận
    rawSend(event, data) {
        const inner = { event };
        if (data !== undefined) inner.data = data;
        this.ws.send(JSON.stringify({ action: "onchat", data: inner }));
    }

    send(event, data) {
        if (event === "LOGIN") this.pendingUser = data?.user ?? null;

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.rawSend(event, data);
        } else {
            const inner = { event };
            if (data !== undefined) inner.data = data;
            this.queue.push(JSON.stringify({ action: "onchat", data: inner }));
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event).add(callback);
        return () => this.listeners.get(event).delete(callback); // hủy đăng ký
    }

    emit(event, msg) {
        this.listeners.get(event)?.forEach((cb) => cb(msg));
    }

    // gửi v chờ phản hồi
    request(event, data, responseEvent, timeoutMs = 8000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                off();
                reject(new Error("Hết thời gian chờ phản hồi"));
            }, timeoutMs);

            const off = this.on(responseEvent, (msg) => {
                clearTimeout(timer);
                off();
                if (msg.status === "success") resolve(msg.data);
                else reject(new Error(msg.mes || "Có lỗi xảy ra"));
            });

            this.send(event, data);
        });
    }

    // API
    register(user, pass) { this.send("REGISTER", { user, pass }); }
    login(user, pass)    { this.send("LOGIN", { user, pass }); }
    logout()             { this.send("LOGOUT"); }
    getUserList()        { this.send("GET_USER_LIST", {}); }
    createRoom(name)     { this.send("CREATE_ROOM", { name }); }
    joinRoom(name)       { this.send("JOIN_ROOM", { name }); }
    leaveRoom(name)      { this.send("OUT_ROOM", { name }); }

    //teen phong hoặc người nhận
    sendChat(type, to, mes) { this.send("SEND_CHAT", { type, to, mes }); }

    // lịch sử tin nhắn
    getMessages(name, page = 1) { this.send("CHAT_PEOPLE_GET_MES", { name, page }); }

    checkUserOnline(user) {
        return this.request("CHAT_CHECK_USER_ONLINE", { user }, "CHECK_USER_ONLINE")
            .then((d) => d.status); // true / false
    }
    checkUserExist(user) {
        return this.request("CHAT_CHECK_USER_EXIST", { user }, "CHECK_USER_EXIST")
            .then((d) => d.status); // true / false
    }
}

export default new ChatSocket();