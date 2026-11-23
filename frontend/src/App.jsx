
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import ProfileForm from "./components/ProfileForm";
import AuthForm from "./components/AuthForm";
import ChatAssistant from "./components/ChatAssistant";

const API_URL = "http://localhost:5000/api";

function App() {
    const [schemes, setSchemes] = useState([]);
    const [selectedScheme, setSelectedScheme] = useState(null);

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);

    const [listError, setListError] = useState("");
    const [detailsError, setDetailsError] = useState("");

    // Questionnaire states
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [questionsLoading, setQuestionsLoading] = useState(false);

    // Assessment states
    const [assessment, setAssessment] = useState(null);
    const [assessmentLoading, setAssessmentLoading] = useState(false);
    const [assessmentError, setAssessmentError] = useState("");

    // Authentication
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setUser(data.session?.user ?? null);
        });

        const { data: authListener } =
            supabase.auth.onAuthStateChange(
                (_event, session) => {
                    setUser(session?.user ?? null);
                }
            );

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    // Fetch schemes
    useEffect(() => {
        async function fetchSchemes() {
            try {
                const response = await fetch(`${API_URL}/schemes`);
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message || "Unable to fetch schemes."
                    );
                }

                setSchemes(result.schemes);
            } catch (error) {
                setListError(error.message);
            } finally {
                setLoading(false);
            }
        }

        fetchSchemes();
    }, []);

    // Fetch scheme details, questions and saved responses
    async function viewDetails(schemeId) {
        try {
            setDetailsLoading(true);
            setQuestionsLoading(true);

            setDetailsError("");
            setSelectedScheme(null);

            setQuestions([]);
            setAnswers({});
            setAssessment(null);
            setAssessmentError("");

            const [detailsResponse, questionsResponse] =
                await Promise.all([
                    fetch(`${API_URL}/schemes/${schemeId}`),
                    fetch(`${API_URL}/schemes/${schemeId}/questions`)
                ]);

            const detailsResult = await detailsResponse.json();
            const questionsResult = await questionsResponse.json();

            if (!detailsResponse.ok || !detailsResult.success) {
                throw new Error(
                    detailsResult.message ||
                    "Unable to load scheme details."
                );
            }

            if (!questionsResponse.ok || !questionsResult.success) {
                throw new Error(
                    questionsResult.message ||
                    "Unable to load questions."
                );
            }

            setSelectedScheme(detailsResult);
            setQuestions(questionsResult.questions || []);

            // Restore previously saved response
            if (user && questionsResult.questions?.length > 0) {
                const { data: savedResponse, error } = await supabase
                    .from("scheme_questionnaire_responses")
                    .select("answers, assessment")
                    .eq("user_id", user.id)
                    .eq("scheme_id", schemeId)
                    .maybeSingle();

                if (error) {
                    console.error("Response loading error:", error.message);
                    setAssessmentError(
                        "Could not load previously saved answers."
                    );
                } else if (savedResponse) {
                    setAnswers(savedResponse.answers || {});
                    setAssessment(savedResponse.assessment || null);
                }
            }

        } catch (error) {
            setDetailsError(error.message);
        } finally {
            setDetailsLoading(false);
            setQuestionsLoading(false);
        }
    }

    // Handle questionnaire answers
    function handleAnswerChange(fieldName, value) {
        setAnswers((previousAnswers) => ({
            ...previousAnswers,
            [fieldName]: value
        }));

        setAssessment(null);
        setAssessmentError("");
    }

    // Submit questionnaire and save response
    async function handleQuestionnaireSubmit() {
        try {
            setAssessmentLoading(true);
            setAssessmentError("");
            setAssessment(null);

            const response = await fetch(
                `${API_URL}/schemes/${selectedScheme.scheme.id}/assess-questionnaire`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        answers: answers
                    })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Assessment failed."
                );
            }

            // Display the assessment result
            setAssessment(result);

            // Save response for logged-in citizen
            if (user) {
                const { error } = await supabase
                    .from("scheme_questionnaire_responses")
                    .upsert(
                        {
                            user_id: user.id,
                            scheme_id: selectedScheme.scheme.id,
                            answers: answers,
                            assessment: result,
                            updated_at: new Date().toISOString()
                        },
                        {
                            onConflict: "user_id,scheme_id"
                        }
                    );

                if (error) {
                    console.error("Response saving error:", error.message);
                    setAssessmentError(
                        "Assessment completed, but saving failed: " +
                        error.message
                    );
                }
            } else {
                setAssessmentError(
                    "Assessment completed. Please log in to save your answers."
                );
            }

        } catch (error) {
            setAssessmentError(error.message);
        } finally {
            setAssessmentLoading(false);
        }
    }

    // Logout
    async function handleLogout() {
        const { error } = await supabase.auth.signOut();

        if (error) {
            alert(error.message);
        } else {
            setUser(null);
            setAnswers({});
            setAssessment(null);
        }
    }

    return (
        <div
            style={{
                fontFamily: "Arial, sans-serif",
                padding: "30px",
                maxWidth: "1000px",
                margin: "auto"
            }}
        >
            {/* Header */}
            <header style={{ textAlign: "center" }}>
                <h1 style={{ fontSize: "48px" }}>
                    GramConnect
                </h1>

                <p>
                    AI-Powered Government Scheme Assistance Platform
                </p>
            </header>

            <hr />

            {/* Scheme listing */}
            <h2 style={{ textAlign: "center" }}>
                Available Government Schemes
            </h2>

            {loading && <p>Loading schemes...</p>}

            {listError && (
                <p style={{ color: "red" }}>
                    {listError}
                </p>
            )}

            {schemes.map((scheme) => (
                <div
                    key={scheme.id}
                    style={{
                        border: "1px solid #aaa",
                        borderRadius: "12px",
                        padding: "25px",
                        marginBottom: "20px"
                    }}
                >
                    <h2>{scheme.name}</h2>

                    <p>
                        <strong>Category:</strong> {scheme.category}
                    </p>

                    <p>{scheme.description}</p>

                    <p>
                        <strong>Coverage:</strong> {scheme.state_scope}
                    </p>

                    <button onClick={() => viewDetails(scheme.id)}>
                        View Details
                    </button>
                </div>
            ))}

            {detailsLoading && (
                <p>Loading scheme details...</p>
            )}

            {detailsError && (
                <p style={{ color: "red" }}>
                    {detailsError}
                </p>
            )}

            {/* Selected scheme details */}
            {selectedScheme && (
                <section
                    style={{
                        border: "1px solid #4CAF50",
                        borderRadius: "12px",
                        padding: "25px",
                        marginTop: "25px"
                    }}
                >
                    <h2>
                        {selectedScheme.scheme.name} — Details
                    </h2>

                    {/* Eligibility rules */}
                    <h3>Eligibility Rules</h3>

                    {selectedScheme.eligibility_rules.map((rule) => (
                        <p key={rule.id}>
                            <strong>
                                {rule.rule_type.toUpperCase()}:
                            </strong>{" "}
                            {rule.description}
                        </p>
                    ))}

                    {/* Documents */}
                    <h3>Required Documents Checklist</h3>

                    {selectedScheme.documents.map((doc) => (
                        <p key={doc.id}>
                            <label>
                                <input type="checkbox" />
                                {" "}{doc.document_name}
                            </label>
                        </p>
                    ))}

                    <a
                        href={selectedScheme.scheme.official_url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Visit Official Website
                    </a>

                    <hr />

                    {/* Dynamic questionnaire */}
                    {questionsLoading && (
                        <p>Loading questionnaire...</p>
                    )}

                    {questions.length > 0 && (
                        <div>
                            <h2>Scheme-Specific Questionnaire</h2>

                            <p>
                                Please answer the following questions
                                about your household.
                            </p>

                            {questions.map((question) => (
                                <div
                                    key={question.id}
                                    style={{ marginBottom: "22px" }}
                                >
                                    <label>
                                        <strong>
                                            {question.order_index}.{" "}
                                            {question.question_text}
                                        </strong>

                                        {question.is_required && (
                                            <span style={{ color: "red" }}>
                                                {" "}*
                                            </span>
                                        )}
                                    </label>

                                    <br />
                                    <br />

                                    {/* Yes / No questions */}
                                    {question.input_type === "boolean" && (
                                        <select
                                            value={
                                                answers[question.field_name] ?? ""
                                            }
                                            onChange={(e) =>
                                                handleAnswerChange(
                                                    question.field_name,
                                                    e.target.value
                                                )
                                            }
                                        >
                                            <option value="">
                                                Select an answer
                                            </option>
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                            <option value="unknown">
                                                Not sure
                                            </option>
                                        </select>
                                    )}

                                    {/* Dropdown questions */}
                                    {question.input_type === "select" && (
                                        <select
                                            value={
                                                answers[question.field_name] ?? ""
                                            }
                                            onChange={(e) =>
                                                handleAnswerChange(
                                                    question.field_name,
                                                    e.target.value
                                                )
                                            }
                                        >
                                            <option value="">
                                                Select an option
                                            </option>

                                            {(question.options || []).map(
                                                (option, index) => (
                                                    <option
                                                        key={index}
                                                        value={option}
                                                    >
                                                        {option}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    )}

                                    {/* Numeric questions */}
                                    {question.input_type === "number" && (
                                        <input
                                            type="number"
                                            min="0"
                                            value={
                                                answers[question.field_name] ?? ""
                                            }
                                            onChange={(e) =>
                                                handleAnswerChange(
                                                    question.field_name,
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Enter a number"
                                        />
                                    )}

                                    {/* Text questions */}
                                    {question.input_type === "text" && (
                                        <input
                                            type="text"
                                            value={
                                                answers[question.field_name] ?? ""
                                            }
                                            onChange={(e) =>
                                                handleAnswerChange(
                                                    question.field_name,
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Enter your answer"
                                        />
                                    )}
                                </div>
                            ))}

                            {/* Disclaimer */}
                            <p
                                style={{
                                    background: "#fff3cd",
                                    color: "#664d03",
                                    padding: "12px",
                                    borderRadius: "8px"
                                }}
                            >
                                These questions provide preliminary
                                information only. Final beneficiary selection
                                is subject to official government verification.
                            </p>

                            {/* Answer counter */}
                            <p>
                                <strong>
                                    Questions answered:{" "}
                                    {
                                        Object.values(answers).filter(
                                            (value) =>
                                                value !== "" &&
                                                value !== "unknown"
                                        ).length
                                    } / {questions.length}
                                </strong>
                            </p>

                            {/* Submit button */}
                            <button
                                onClick={handleQuestionnaireSubmit}
                                disabled={assessmentLoading}
                                style={{
                                    padding: "12px 24px",
                                    background: "#2563eb",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    cursor: assessmentLoading
                                        ? "not-allowed"
                                        : "pointer"
                                }}
                            >
                                {assessmentLoading
                                    ? "Checking..."
                                    : "Submit & Check Eligibility"}
                            </button>

                            {assessmentError && (
                                <p style={{ color: "red" }}>
                                    {assessmentError}
                                </p>
                            )}

                            {/* Assessment result */}
                            {assessment && (
                                <div
                                    style={{
                                        border: "1px solid #2563eb",
                                        borderRadius: "10px",
                                        padding: "18px",
                                        marginTop: "20px"
                                    }}
                                >
                                    <h3>
                                        Preliminary Assessment Result
                                    </h3>

                                    <p>
                                        <strong>Status:</strong>{" "}
                                        {assessment.status}
                                    </p>

                                    <p>{assessment.message}</p>

                                    {/* PM-JAY pathway information */}
{assessment.pathway && (
    <div style={{
        border: "1px solid #16a34a",
        borderRadius: "8px",
        padding: "15px",
        marginTop: "15px"
    }}>
        <h4>Recommended Assistance Pathway</h4>

        <p>
            <strong>Pathway:</strong>{" "}
            {assessment.pathway.replaceAll("_", " ")}
        </p>

        <p>
            <strong>Senior citizen 70+:</strong>{" "}
            {assessment.senior_citizen_70_plus ? "Yes" : "No"}
        </p>

        <p>
            <strong>Existing PM-JAY card:</strong>{" "}
            {assessment.has_pmjay_card ? "Yes" : "No"}
        </p>

        <h4>Recommended Next Steps</h4>

        <ol>
            {assessment.next_steps?.map((step, index) => (
                <li key={index}>{step}</li>
            ))}
        </ol>

        <a
            href={assessment.official_portal}
            target="_blank"
            rel="noopener noreferrer"
        >
            Check Official PM-JAY Beneficiary Portal
        </a>
    </div>
)}

                                    {/* Housing information */}
                                    {assessment.housing_profile && (
                                        <div
                                            style={{
                                                marginTop: "15px",
                                                padding: "15px",
                                                border: "1px solid #777",
                                                borderRadius: "8px"
                                            }}
                                        >
                                            <h4>
                                                Household Housing Information
                                            </h4>

                                            <p>
                                                <strong>Rural household:</strong>{" "}
                                                {answers.is_rural_resident === "true"
                                                    ? "Yes"
                                                    : "No"}
                                            </p>

                                            <p>
                                                <strong>Houseless:</strong>{" "}
                                                {assessment.housing_profile.is_houseless
                                                    ? "Yes"
                                                    : "No"}
                                            </p>

                                            <p>
                                                <strong>House type:</strong>{" "}
                                                {assessment.housing_profile.house_type}
                                            </p>

                                            <p>
                                                <strong>Number of rooms:</strong>{" "}
                                                {assessment.housing_profile.number_of_rooms}
                                            </p>

                                            <p>
                                                <strong>Destitute household member:</strong>{" "}
                                                {assessment.housing_profile.is_destitute_living_on_alms
                                                    ? "Yes"
                                                    : "No"}
                                            </p>
                                        </div>
                                    )}

                                    {assessment.missing_fields?.length > 0 && (
                                        <div>
                                            <strong>
                                                Missing information:
                                            </strong>

                                            <ul>
                                                {assessment.missing_fields.map(
                                                    (field) => (
                                                        <li key={field}>
                                                            {field}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        </div>
                                    )}

                                    {assessment.failed_checks?.length > 0 && (
                                        <div>
                                            <strong>
                                                Screening conditions triggered:
                                            </strong>

                                            <ul>
                                                {assessment.failed_checks.map(
                                                    (check) => (
                                                        <li key={check.field}>
                                                            {check.reason}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        </div>
                                    )}

                                    <p style={{ fontSize: "13px" }}>
                                        {assessment.disclaimer}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            <hr />

             {/* AI Chat Assistant */}
            <ChatAssistant />

            <hr />

            {/* Authentication section */}
            <section>
                {user ? (
                    <div>
                        <h2>Welcome to GramConnect!</h2>

                        <p>
                            Logged in as: {user.email}
                        </p>

                        <button onClick={handleLogout}>
                            Logout
                        </button>

                        <ProfileForm
                            user={user}
                            schemes={schemes}
                        />
                    </div>
                ) : (
                    <AuthForm onLogin={setUser} />
                )}
            </section>

        </div>
    );
}

export default App;
