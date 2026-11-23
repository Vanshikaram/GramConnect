
import { useState } from "react";
import { supabase } from "../lib/supabase";

function AuthForm({ onLogin }) {
    const [isSignup, setIsSignup] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            if (isSignup) {
                const { data, error } =
                    await supabase.auth.signUp({
                        email,
                        password
                    });

                if (error) throw error;

                if (data.session) {
                    onLogin(data.session.user);
                    setMessage("Account created successfully!");
                } else {
                    setMessage(
                        "Account created. Please verify your email, then log in."
                    );
                }

            } else {
                const { data, error } =
                    await supabase.auth.signInWithPassword({
                        email,
                        password
                    });

                if (error) throw error;

                onLogin(data.user);
                setMessage("Login successful!");
            }

        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            border: "1px solid #aaa",
            borderRadius: "12px",
            padding: "25px",
            marginTop: "25px"
        }}>
            <h2>{isSignup ? "Create Account" : "Login"}</h2>

            <form onSubmit={handleSubmit}>
                <label>Email Address</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                        display: "block",
                        width: "100%",
                        padding: "10px",
                        margin: "10px 0"
                    }}
                />

                <label>Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    style={{
                        display: "block",
                        width: "100%",
                        padding: "10px",
                        margin: "10px 0"
                    }}
                />

                <button type="submit" disabled={loading}>
                    {loading
                        ? "Please wait..."
                        : isSignup
                            ? "Sign Up"
                            : "Login"}
                </button>
            </form>

            <p>{message}</p>

            <button
                type="button"
                onClick={() => {
                    setIsSignup(!isSignup);
                    setMessage("");
                }}
            >
                {isSignup
                    ? "Already have an account? Login"
                    : "New user? Create an account"}
            </button>
        </div>
    );
}

export default AuthForm;
