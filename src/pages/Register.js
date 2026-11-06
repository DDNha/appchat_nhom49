import { useEffect, useState } from "react";
import chatSocket from "../services/chatSocket";

export default function Register() {
    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");
    const [message, setMessage] = useState({ type: "", text: "" });

    useEffect(() => {
        chatSocket.connect();

        const offRegister = chatSocket.on("REGISTER", (msg) => {
            if (msg.status === "success") {
                setMessage({ type: "ok", text: msg.data || "Đăng ký thành công" });
            } else {
                setMessage({ type: "error", text: msg.mes || "Đăng ký thất bại" });
            }
        });

        return offRegister;
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });
        //name
        if (!/^\w+$/.test(user)) {
            setMessage({
                type: "error",
                text: "Tên người dùng chỉ gồm chữ cái, số và dấu gạch dưới.",
            });
            return;
        }
        chatSocket.send("REGISTER", { user, pass });
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Đăng ký</h2>
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
            <button type="submit">Đăng ký</button>
            {message.text && (
                <p style={{ color: message.type === "ok" ? "green" : "red" }}>
                    {message.text}
                </p>
            )}
        </form>
    );
}