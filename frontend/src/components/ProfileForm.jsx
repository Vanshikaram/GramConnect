
import { useState } from "react";
import { supabase } from "../lib/supabase";

const API_URL = "http://localhost:5000/api";

function ProfileForm({ user, schemes = [] }) {
    const [formData, setFormData] = useState({
        full_name: "",
        age: "",
        gender: "",
        state: "",
        district: "",
        occupation: "",
        annual_income: "",
        land_ownership: "",
        landholding_farmer_family: "unknown",
        institutional_landholder: "unknown"
    });

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [checkingScheme, setCheckingScheme] = useState(null);
    const [results, setResults] = useState({});

    function handleChange(event) {
        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value
        }));

        setSaved(false);
        setResults({});
        setMessage("");
    }

    function toNullableBoolean(value) {
        if (value === "true") return true;
        if (value === "false") return false;
        return null;
    }

    function getProfileData() {
        return {
            id: user.id,
            full_name: formData.full_name.trim(),
            age: Number(formData.age),
            gender: formData.gender,
            state: formData.state.trim(),
            district: formData.district.trim(),
            occupation: formData.occupation,
            annual_income: Number(formData.annual_income),
            land_ownership: formData.land_ownership === "true",
            landholding_farmer_family: toNullableBoolean(
                formData.landholding_farmer_family
            ),
            institutional_landholder: toNullableBoolean(
                formData.institutional_landholder
            ),
            updated_at: new Date().toISOString()
        };
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (!user?.id) {
            setMessage("Please log in first.");
            return;
        }

        setLoading(true);
        setMessage("");
        setSaved(false);
        setResults({});

        try {
            const profileData = getProfileData();

            const { error } = await supabase
                .from("profiles")
                .upsert(profileData, {
                    onConflict: "id"
                });

            if (error) throw error;

            setSaved(true);
            setMessage("Profile saved successfully!");

        } catch (error) {
            console.error("Profile saving error:", error.message);
            setMessage("Unable to save profile: " + error.message);

        } finally {
            setLoading(false);
        }
    }

    async function checkEligibility(scheme) {
        if (!saved) {
            setMessage("Please save your profile before checking eligibility.");
            return;
        }

        setCheckingScheme(scheme.id);

        setResults((previous) => ({
            ...previous,
            [scheme.id]: null
        }));

        try {
            const response = await fetch(
                `${API_URL}/schemes/${scheme.id}/check-eligibility`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        profile: getProfileData()
                    })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Eligibility check failed."
                );
            }

            setResults((previous) => ({
                ...previous,
                [scheme.id]: result
            }));

        } catch (error) {
            console.error("Eligibility error:", error.message);

            setResults((previous) => ({
                ...previous,
                [scheme.id]: {
                    error: error.message
                }
            }));

        } finally {
            setCheckingScheme(null);
        }
    }

    const inputStyle = {
        display: "block",
        width: "100%",
        padding: "10px",
        marginTop: "6px",
        marginBottom: "15px",
        boxSizing: "border-box"
    };

    return (
        <div style={{
            border: "1px solid #aaa",
            borderRadius: "12px",
            padding: "25px",
            marginTop: "30px",
            textAlign: "left"
        }}>

            <h2>Citizen Profile</h2>

            <p>Enter your details to discover relevant schemes.</p>

            <form onSubmit={handleSubmit}>

                <label>Full Name</label>
                <input
                    style={inputStyle}
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                />

                <label>Age</label>
                <input
                    style={inputStyle}
                    type="number"
                    name="age"
                    min="0"
                    max="120"
                    value={formData.age}
                    onChange={handleChange}
                    required
                />

                <label>Gender</label>
                <select
                    style={inputStyle}
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">
                        Prefer not to say
                    </option>
                </select>

                <label>State</label>
                <input
                    style={inputStyle}
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                />

                <label>District</label>
                <input
                    style={inputStyle}
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    required
                />

                <label>Occupation</label>
                <select
                    style={inputStyle}
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleChange}
                    required
                >
                    <option value="">Select occupation</option>
                    <option value="Farmer">Farmer</option>
                    <option value="Student">Student</option>
                    <option value="Worker">Worker</option>
                    <option value="Self Employed">Self Employed</option>
                    <option value="Unemployed">Unemployed</option>
                    <option value="Other">Other</option>
                </select>

                <label>Annual Family Income (₹)</label>
                <input
                    style={inputStyle}
                    type="number"
                    name="annual_income"
                    min="0"
                    value={formData.annual_income}
                    onChange={handleChange}
                    required
                />

                <label>Do you own agricultural land?</label>
                <select
                    style={inputStyle}
                    name="land_ownership"
                    value={formData.land_ownership}
                    onChange={handleChange}
                    required
                >
                    <option value="">Select an option</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>

                <hr />

                <h3>Additional Farmer Information</h3>

                <label>
                    Does your family qualify as a landholding farmer
                    family according to applicable land records?
                </label>

                <select
                    style={inputStyle}
                    name="landholding_farmer_family"
                    value={formData.landholding_farmer_family}
                    onChange={handleChange}
                >
                    <option value="unknown">Not sure</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>

                <label>
                    Is the applicant an institutional landholder?
                </label>

                <select
                    style={inputStyle}
                    name="institutional_landholder"
                    value={formData.institutional_landholder}
                    onChange={handleChange}
                >
                    <option value="unknown">Not sure</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>

                <p style={{ fontSize: "13px" }}>
                    Select Not sure if you cannot verify an answer.
                    This assessment is preliminary.
                </p>

                <button type="submit" disabled={loading}>
                    {loading ? "Saving..." : "Save Profile"}
                </button>

            </form>

            {message && (
                <p style={{ marginTop: "15px" }}>
                    {message}
                </p>
            )}

            {saved && (
                <section style={{ marginTop: "25px" }}>
                    <hr />
                    <h2>Check Scheme Eligibility</h2>

                    <p>
                        Your profile is saved. Select a scheme
                        to check your preliminary eligibility.
                    </p>

                    {schemes.map((scheme) => (
                        <div
                            key={scheme.id}
                            style={{
                                border: "1px solid #aaa",
                                borderRadius: "8px",
                                padding: "15px",
                                marginBottom: "15px"
                            }}
                        >
                            <h3>{scheme.name}</h3>
                            <p>{scheme.category}</p>

                            <button
                                type="button"
                                disabled={checkingScheme !== null}
                                onClick={() => checkEligibility(scheme)}
                            >
                                {checkingScheme === scheme.id
                                    ? "Checking..."
                                    : "Check My Eligibility"}
                            </button>

                            {results[scheme.id] && (
                                <div style={{ marginTop: "15px" }}>
                                    {results[scheme.id].error ? (
                                        <p style={{ color: "red" }}>
                                            {results[scheme.id].error}
                                        </p>
                                    ) : (
                                        <>
                                            <h4>
                                                Assessment: {
                                                    results[scheme.id].status
                                                }
                                            </h4>

                                            <p>
                                                {results[scheme.id].message}
                                            </p>

                                            <h4>Rule Evaluation</h4>

                                            {results[scheme.id].evaluated_rules.map(
                                                (rule, index) => (
                                                    <p key={index}>
                                                        <strong>
                                                            {rule.field}:
                                                        </strong>{" "}
                                                        {rule.status}
                                                        <br />
                                                        {rule.explanation}
                                                    </p>
                                                )
                                            )}

                                            <p style={{ fontSize: "13px" }}>
                                                {results[scheme.id].disclaimer}
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </section>
            )}

        </div>
    );
}

export default ProfileForm;
