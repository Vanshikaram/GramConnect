
import { useState } from "react";

const API_URL = "http://localhost:5000/api";

function ChatAssistant() {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            text: "Namaste! Welcome to GramConnect. Ask me anything about government schemes such as PM-KISAN, PMAY-G or Ayushman Bharat."
        }
    ]);
    const [loading, setLoading] = useState(false);

    const sendMessage = async (e) => {
        e.preventDefault();

        if (!message.trim() || loading) return;

        const userMessage = message.trim();

        setMessages((prev) => [
            ...prev,
            { role: "user", text: userMessage }
        ]);

        setMessage("");
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                
body: JSON.stringify({
    message: userMessage,
    history: messages.slice(1).map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        text: item.text
    }))
})

            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Something went wrong.");
            }

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: data.reply || "I couldn't generate a response."
                }
            ]);
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: error.message || "Unable to connect to the AI assistant."
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            maxWidth: "750px",
            margin: "30px auto",
            padding: "20px",
            border: "1px solid #ddd",
            borderRadius: "12px",
            background: "#fff"
        }}>
            <h2>GramConnect AI Assistant</h2>
            <p>Ask questions about Indian government welfare schemes.</p>

            <div style={{
                height: "350px",
                overflowY: "auto",
                padding: "12px",
                background: "#f8fafc",
                borderRadius: "8px",
                marginBottom: "15px"
            }}>
                {messages.map((item, index) => (
                    <div
                        key={index}
                        style={{
                            display: "flex",
                            justifyContent:
                                item.role === "user" ? "flex-end" : "flex-start",
                            marginBottom: "12px"
                        }}
                    >
                        <div style={{
                            maxWidth: "80%",
                            padding: "12px",
                            borderRadius: "10px",
                            background:
                                item.role === "user" ? "#dcfce7" : "#e2e8f0",
                            whiteSpace: "pre-wrap",
                            lineHeight: "1.5"
                        }}>
                            <strong>
                                {item.role === "user" ? "You" : "GramConnect AI"}
                            </strong>
                            <p style={{ margin: "5px 0 0" }}>{item.text}</p>
                        </div>
                    </div>
                ))}

                {loading && <p>GramConnect AI is thinking...</p>}
            </div>

            <form onSubmit={sendMessage} style={{
                display: "flex",
                gap: "10px"
            }}>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask your question..."
                    disabled={loading}
                    style={{
                        flex: 1,
                        padding: "12px",
                        border: "1px solid #ccc",
                        borderRadius: "8px"
                    }}
                />

                <button
                    type="submit"
                    disabled={loading || !message.trim()}
                    style={{
                        padding: "12px 20px",
                        background: "#15803d",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer"
                    }}
                >
                    Send
                </button>
            </form>

            <p style={{
                fontSize: "12px",
                color: "#666",
                marginTop: "12px"
            }}>
                Note: AI responses are for general guidance only. Always verify
                eligibility and scheme details through official government sources.
            </p>
        </div>
    );
}

export default ChatAssistant;
