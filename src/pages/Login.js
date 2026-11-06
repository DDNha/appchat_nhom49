import { useEffect, useState } from "react";
import chatSocket from "../services/chatSocket";

export default function Login({ onSuccess }) {
    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        chatSocket.connect();

        // chatSocket tự lưu user + RE_LOGIN_CODE khi LOGIN thành công
        const offLogin = chatSocket.on("LOGIN", (msg) => {
            if (msg.status === "success") onSuccess?.();
            else setError(msg.mes || "Đăng nhập thất bại");
        });

        return offLogin;
    }, [onSuccess]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError("");
        chatSocket.login(user, pass);
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Đăng nhập</h2>
            <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="Tên đăng nhập"
            />
            <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Mật khẩu"
            />
            <button type="submit">Đăng nhập</button>
            {error && <p style={{ color: "red" }}>{error}</p>}
        </form>
    );
}