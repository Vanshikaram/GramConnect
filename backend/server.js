
import { GoogleGenAI } from "@google/genai";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import supabase from "./config/supabase.js";

dotenv.config();


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: "http://localhost:5173"
}));

app.use(express.json());

// Gemini AI configuration
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// GramConnect AI Assistant API
app.post("/api/chat", async (req, res) => {
    try {
        const { message, history = [] } = req.body;
        // Prepare conversation history for Gemini
const validHistory = Array.isArray(history)
    ? history
        .filter(
            (item) =>
                item &&
                ["user", "model"].includes(item.role) &&
                typeof item.text === "string" &&
                item.text.trim()
        )
        .slice(-12)
    : [];

    console.log("\n========== CHAT DEBUG ==========");
console.log("Current question:", message);
console.log("Previous messages received:", validHistory.length);
console.log("Conversation history:", JSON.stringify(validHistory, null, 2));
console.log("================================\n");

const contents = [
    ...validHistory.map((item) => ({
        role: item.role,
        parts: [{ text: item.text.slice(0, 4000) }]
    })),
    {
        role: "user",
        parts: [{ text: message }]
    }
];

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a question."
            });
        }

        if (message.length > 2000) {
            return res.status(400).json({
                success: false,
                message: "Your question is too long. Please keep it under 2000 characters."
            });
        }

        
let response;

try {
    // Primary model
    response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: contents,
        config: {
            systemInstruction: `
                You are GramConnect AI Assistant.

                Help Indian citizens understand government schemes
                in simple language.

                Support English and Hindi.

                Explain eligibility, documents and application steps.

                Never guarantee official eligibility.

                Never invent government rules or application links.

                Direct users to official government portals
                when verification is needed.

                Never ask for Aadhaar numbers, bank details,
                passwords or OTPs.
            `
        }
    });

} catch (error) {
    // Use fallback only when the primary model is overloaded
    if (
        error.status === 503 ||
        error.message?.includes("503") ||
        error.message?.includes("UNAVAILABLE")
    ) {
        console.log("Primary Gemini model busy. Trying fallback...");

        response = await ai.models.generateContent({
            model: "gemini-3.5-flash-lite",
            contents: contents,
            config: {
                systemInstruction: `
                    You are GramConnect AI Assistant.
                    Help Indian citizens understand government
                    welfare schemes in simple language.
                    Support English and Hindi.
                    Never guarantee official eligibility.
                    Never invent government rules.
                    Direct users to official government portals.
                    Never request Aadhaar numbers, bank details,
                    passwords or OTPs.
                `
            }
        });
    } else {
        throw error;
    }
}


        return res.json({
            success: true,
            reply: response.text
        });

    } catch (error) {
        console.error("Gemini Chat Error:", error);

        return res.status(500).json({
            success: false,
            message: "The AI assistant is temporarily unavailable. Please try again."
        });
    }
});

// Home route
app.get("/", (req, res) => {
    res.send("Welcome to GramConnect Backend!");
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "GramConnect backend is running!"
    });
});

// Get all active schemes
app.get("/api/schemes", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("schemes")
            .select("*")
            .eq("is_active", true)
            .order("name");

        if (error) {
            throw error;
        }

        res.status(200).json({
            success: true,
            count: data.length,
            schemes: data
        });

    } catch (error) {
        console.error("Schemes API error:", error);
console.error("Underlying cause:", error.cause);

        res.status(500).json({
            success: false,
            message: "Unable to fetch schemes"
        });
    }
});

// Get individual scheme details
app.get("/api/schemes/:id", async (req, res) => {
    try {
        const schemeId = req.params.id;

        // Get scheme
        const { data: scheme, error: schemeError } =
            await supabase
                .from("schemes")
                .select("*")
                .eq("id", schemeId)
                .eq("is_active", true)
                .maybeSingle();

        if (schemeError) {
            throw schemeError;
        }

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: "Scheme not found"
            });
        }

        // Get eligibility rules and documents
        const [rulesResult, documentsResult] =
            await Promise.all([
                supabase
                    .from("eligibility_rules")
                    .select("*")
                    .eq("scheme_id", schemeId),

                supabase
                    .from("documents")
                    .select("*")
                    .eq("scheme_id", schemeId)
            ]);

        if (rulesResult.error) {
            throw rulesResult.error;
        }

        if (documentsResult.error) {
            throw documentsResult.error;
        }

        res.status(200).json({
            success: true,
            scheme: scheme,
            eligibility_rules: rulesResult.data,
            documents: documentsResult.data
        });

    } catch (error) {
        console.error("Scheme details API error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch scheme details"
        });
    }
});


// Eligibility checking API
app.post("/api/schemes/:id/check-eligibility", async (req, res) => {
    try {
        const schemeId = req.params.id;
        const profile = req.body.profile;

        if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
            return res.status(400).json({
                success: false,
                message: "A valid citizen profile is required."
            });
        }

        // Fetch the selected active scheme
        const { data: scheme, error: schemeError } = await supabase
            .from("schemes")
            .select("*")
            .eq("id", schemeId)
            .eq("is_active", true)
            .maybeSingle();

        if (schemeError) throw schemeError;

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: "Scheme not found."
            });
        }

        // Fetch its eligibility rules
        const { data: rules, error: rulesError } = await supabase
            .from("eligibility_rules")
            .select("*")
            .eq("scheme_id", schemeId);

        if (rulesError) throw rulesError;

        if (!rules || rules.length === 0) {
            return res.status(200).json({
                success: true,
                scheme: scheme.name,
                status: "NEEDS_MORE_INFORMATION",
                message: "No eligibility rules are configured yet.",
                evaluated_rules: []
            });
        }

        let hasMissingInformation = false;
        let doesNotMatch = false;

        const evaluatedRules = [];

        for (const rule of rules) {
            const actualValue = profile[rule.field_name];

            // Unknown or unanswered information
            if (
                actualValue === undefined ||
                actualValue === null ||
                actualValue === ""
            ) {
                hasMissingInformation = true;

                evaluatedRules.push({
                    field: rule.field_name,
                    rule_type: rule.rule_type,
                    status: "UNKNOWN",
                    explanation: rule.description
                });

                continue;
            }

            // This first version supports equality rules
            if (rule.operator !== "equals") {
                hasMissingInformation = true;

                evaluatedRules.push({
                    field: rule.field_name,
                    status: "UNSUPPORTED_RULE",
                    explanation: "This rule needs additional configuration."
                });

                continue;
            }

            const expectedValue = rule.expected_value;

            const matches =
                String(actualValue).toLowerCase() ===
                String(expectedValue).toLowerCase();

            let ruleStatus;

            if (rule.rule_type === "inclusion") {
                ruleStatus = matches ? "PASSED" : "NOT_SATISFIED";

                if (!matches) {
                    doesNotMatch = true;
                }

            } else if (rule.rule_type === "exclusion") {
                ruleStatus = matches ? "EXCLUDED" : "PASSED";

                if (matches) {
                    doesNotMatch = true;
                }

            } else {
                ruleStatus = "UNKNOWN";
                hasMissingInformation = true;
            }

            evaluatedRules.push({
                field: rule.field_name,
                rule_type: rule.rule_type,
                status: ruleStatus,
                explanation: rule.description
            });
        }

        // Determine preliminary assessment
        let status;
        let message;

        if (doesNotMatch) {
            status = "DOES_NOT_APPEAR_TO_MATCH";
            message = "One or more configured eligibility conditions are not satisfied.";

        } else if (hasMissingInformation) {
            status = "NEEDS_MORE_INFORMATION";
            message = "Some information is missing or requires verification.";

        } else {
            status = "POTENTIALLY_RELEVANT";
            message = "All currently configured rules were satisfied.";
        }

        return res.status(200).json({
            success: true,
            scheme: scheme.name,
            status,
            message,
            evaluated_rules: evaluatedRules,
            disclaimer: "This is a preliminary assessment based on configured information. It is not an official eligibility decision."
        });

    } catch (error) {
        console.error("Eligibility API error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to evaluate eligibility."
        });
    }
});

// Get scheme-specific questionnaire
app.get("/api/schemes/:id/questions", async (req, res) => {
    try {
        const schemeId = req.params.id;

        const { data: scheme, error: schemeError } = await supabase
            .from("schemes")
            .select("id, name")
            .eq("id", schemeId)
            .eq("is_active", true)
            .maybeSingle();

        if (schemeError) throw schemeError;

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: "Scheme not found."
            });
        }

        const { data: questions, error } = await supabase
            .from("scheme_questions")
            .select("*")
            .eq("scheme_id", schemeId)
            .order("order_index", { ascending: true });

        if (error) throw error;

        return res.json({
            success: true,
            scheme: scheme.name,
            total_questions: questions.length,
            questions
        });

    } catch (error) {
        console.error("Questionnaire API error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch scheme questions."
        });
    }
});



// Preliminary assessment API for PM-KISAN and PMAY-G
app.post("/api/schemes/:id/assess-questionnaire", async (req, res) => {
    try {
        const schemeId = req.params.id;
        const answers = req.body.answers;

        // Validate request
        if (
            !answers ||
            typeof answers !== "object" ||
            Array.isArray(answers)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid questionnaire answers are required."
            });
        }

        // Fetch active scheme
        const { data: scheme, error: schemeError } = await supabase
            .from("schemes")
            .select("id, name")
            .eq("id", schemeId)
            .eq("is_active", true)
            .maybeSingle();

        if (schemeError) throw schemeError;

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: "Scheme not found."
            });
        }

        // Fetch scheme questions
        const { data: questions, error: questionsError } = await supabase
            .from("scheme_questions")
            .select("*")
            .eq("scheme_id", schemeId)
            .order("order_index", { ascending: true });

        if (questionsError) throw questionsError;

        if (!questions || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No questionnaire is configured."
            });
        }

        // Validate required answers and answer types
        const missingFields = [];
        const invalidFields = [];

        for (const question of questions) {
            const value = answers[question.field_name];

            if (
                question.is_required &&
                (
                    value === undefined ||
                    value === null ||
                    value === "" ||
                    value === "unknown"
                )
            ) {
                missingFields.push(question.field_name);
                continue;
            }

            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                continue;
            }

            if (question.input_type === "number") {
                const numberValue = Number(value);

                if (
                    !Number.isFinite(numberValue) ||
                    numberValue < 0
                ) {
                    invalidFields.push(question.field_name);
                }
            }

            if (question.input_type === "boolean") {
                if (
                    !["true", "false", true, false].includes(value)
                ) {
                    invalidFields.push(question.field_name);
                }
            }

            if (question.input_type === "select") {
                if (
                    !Array.isArray(question.options) ||
                    !question.options.includes(value)
                ) {
                    invalidFields.push(question.field_name);
                }
            }
        }

        if (invalidFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Some answers have invalid values.",
                invalid_fields: invalidFields
            });
        }

        if (missingFields.length > 0) {
            return res.status(200).json({
                success: true,
                scheme: scheme.name,
                status: "NEEDS_MORE_INFORMATION",
                message: "Please complete all required questions.",
                missing_fields: missingFields
            });
        }

        // Helper functions
        const getBoolean = (field) =>
            answers[field] === true ||
            answers[field] === "true";

        const getNumber = (field) =>
            Number(answers[field]);

        // =========================================
        // PM-KISAN ASSESSMENT
        // =========================================

        if (scheme.name === "PM-KISAN") {
            const failedChecks = [];

            // Basic farmer-family condition
            if (!getBoolean("landholding_farmer_family")) {
                failedChecks.push({
                    field: "landholding_farmer_family",
                    reason:
                        "The applicant has not confirmed membership of an eligible landholding farmer family."
                });
            }

            // Institutional landholder exclusion
            if (getBoolean("institutional_landholder")) {
                failedChecks.push({
                    field: "institutional_landholder",
                    reason:
                        "Institutional landholders are excluded under PM-KISAN guidelines."
                });
            }

            // Other PM-KISAN exclusion screening
            const exclusionChecks = [
                {
                    field: "constitutional_post_holder",
                    excluded: getBoolean("constitutional_post_holder"),
                    reason:
                        "A farmer-family member is a current or former holder of a constitutional post."
                },
                {
                    field: "elected_representative",
                    excluded: getBoolean("elected_representative"),
                    reason:
                        "A farmer-family member falls within the specified elected-representative exclusion."
                },
                {
                    field: "government_employee",
                    excluded: getBoolean("government_employee"),
                    reason:
                        "A farmer-family member may fall within the specified government-employee exclusion."
                },
                {
                    field: "pension_10000_or_more",
                    excluded: getBoolean("pension_10000_or_more"),
                    reason:
                        "A farmer-family member may fall within the specified pensioner exclusion."
                },
                {
                    field: "income_tax_payer",
                    excluded: getBoolean("income_tax_payer"),
                    reason:
                        "A farmer-family member paid income tax in the previous assessment year."
                },
                {
                    field: "registered_practising_professional",
                    excluded: getBoolean("registered_practising_professional"),
                    reason:
                        "A farmer-family member may fall within the registered practising-professional exclusion."
                }
            ];

            for (const check of exclusionChecks) {
                if (check.excluded) {
                    failedChecks.push({
                        field: check.field,
                        reason: check.reason
                    });
                }
            }

            if (failedChecks.length > 0) {
                return res.status(200).json({
                    success: true,
                    scheme: scheme.name,
                    status: "DOES_NOT_APPEAR_TO_MATCH",
                    message:
                        "One or more configured PM-KISAN screening conditions were triggered.",
                    failed_checks: failedChecks,
                    disclaimer:
                        "This is a preliminary screening result, not an official PM-KISAN eligibility decision."
                });
            }

            return res.status(200).json({
                success: true,
                scheme: scheme.name,
                status: "NEEDS_OFFICIAL_VERIFICATION",
                message:
                    "No configured exclusion condition was triggered. Farmer-family status and land records must still be verified through the official process.",
                disclaimer:
                    "This result does not confirm eligibility or guarantee benefits. Final eligibility is determined under the official PM-KISAN guidelines."
            });
        }

        // =========================================
        // PMAY-G ASSESSMENT
        // =========================================

        if (scheme.name === "PMAY-G") {
            const failedChecks = [];

            // Rural residence screening
            if (!getBoolean("is_rural_resident")) {
                failedChecks.push({
                    field: "is_rural_resident",
                    reason:
                        "PMAY-G is intended for rural households."
                });
            }

            // PMAY-G exclusion screening
            const exclusionChecks = [
                {
                    field: "has_motorised_three_four_wheeler",
                    excluded: getBoolean("has_motorised_three_four_wheeler"),
                    reason:
                        "Household owns a motorised three-wheeler or four-wheeler."
                },
                {
                    field: "has_mechanised_agricultural_equipment",
                    excluded: getBoolean("has_mechanised_agricultural_equipment"),
                    reason:
                        "Household owns the specified mechanised agricultural equipment."
                },
                {
                    field: "kcc_credit_limit",
                    excluded: getNumber("kcc_credit_limit") >= 50000,
                    reason:
                        "Household KCC credit limit is ₹50,000 or more."
                },
                {
                    field: "has_government_employee",
                    excluded: getBoolean("has_government_employee"),
                    reason:
                        "A household member is a government employee."
                },
                {
                    field: "has_registered_non_agricultural_enterprise",
                    excluded: getBoolean("has_registered_non_agricultural_enterprise"),
                    reason:
                        "Household operates a registered non-agricultural enterprise."
                },
                {
                    field: "highest_member_monthly_income",
                    excluded: getNumber("highest_member_monthly_income") > 15000,
                    reason:
                        "A household member earns more than ₹15,000 per month."
                },
                {
                    field: "pays_income_tax",
                    excluded: getBoolean("pays_income_tax"),
                    reason:
                        "A household member pays income tax."
                },
                {
                    field: "pays_professional_tax",
                    excluded: getBoolean("pays_professional_tax"),
                    reason:
                        "A household member pays professional tax."
                },
                {
                    field: "irrigated_land_acres",
                    excluded: getNumber("irrigated_land_acres") >= 2.5,
                    reason:
                        "Household owns 2.5 acres or more of irrigated land."
                },
                {
                    field: "unirrigated_land_acres",
                    excluded: getNumber("unirrigated_land_acres") >= 5,
                    reason:
                        "Household owns 5 acres or more of unirrigated land."
                }
            ];

            for (const check of exclusionChecks) {
                if (check.excluded) {
                    failedChecks.push({
                        field: check.field,
                        reason: check.reason
                    });
                }
            }

            // Housing deprivation information
            const housingProfile = {
                is_houseless: getBoolean("is_houseless"),
                house_type: answers.house_type,
                number_of_rooms: getNumber("number_of_rooms"),
                is_destitute_living_on_alms:
                    getBoolean("is_destitute_living_on_alms")
            };

            if (failedChecks.length > 0) {
                return res.status(200).json({
                    success: true,
                    scheme: scheme.name,
                    status: "DOES_NOT_APPEAR_TO_MATCH",
                    message:
                        "One or more configured PMAY-G screening conditions were triggered.",
                    failed_checks: failedChecks,
                    housing_profile: housingProfile,
                    disclaimer:
                        "This is a preliminary screening result, not an official government decision."
                });
            }

            return res.status(200).json({
                success: true,
                scheme: scheme.name,
                status: "NEEDS_OFFICIAL_VERIFICATION",
                message:
                    "No configured exclusion condition was triggered. Official beneficiary-list and housing-deprivation verification is still required.",
                housing_profile: housingProfile,
                disclaimer:
                    "This result does not confirm eligibility. Final selection depends on applicable government records, beneficiary identification and official verification."
            });
        }

        
// =========================================
// AYUSHMAN BHARAT PM-JAY ASSESSMENT
// =========================================

if (scheme.name === "Ayushman Bharat PM-JAY") {

    const isSeniorCitizen = getBoolean("is_age_70_or_above");
    const hasCard = getBoolean("has_pmjay_card");
    const beneficiaryStatus = answers.official_beneficiary_status;
    const aadhaarAvailable = getBoolean("aadhaar_available_for_ekyc");

    let pathway;
    let message;

    if (isSeniorCitizen) {
        pathway = "SENIOR_CITIZEN_70_PLUS";

        message =
            "You have indicated that you are 70 or above. The separate PM-JAY senior-citizen pathway may apply irrespective of income. Complete the official enrolment and verification process.";
    } else if (beneficiaryStatus === "Found in beneficiary list") {
        pathway = "EXISTING_BENEFICIARY";

        message =
            "You report that your name appears in the official beneficiary list. Verify your beneficiary details and complete any required enrolment steps through the official portal.";
    } else if (hasCard) {
        pathway = "EXISTING_CARD_HOLDER";

        message =
            "You report having a PM-JAY card. Check your beneficiary and card status through the official portal.";
    } else if (beneficiaryStatus === "Not found in beneficiary list") {
        pathway = "BENEFICIARY_LOOKUP_REQUIRED";

        message =
            "Your name was not found in your previous search. This questionnaire cannot determine entitlement. Check the official portal or contact an authorised Ayushman Mitra or helpdesk.";
    } else {
        pathway = "BENEFICIARY_LOOKUP_REQUIRED";

        message =
            "Check your name in the official PM-JAY beneficiary database to understand the applicable enrolment pathway.";
    }

    return res.status(200).json({
        success: true,
        scheme: scheme.name,
        status: "NEEDS_OFFICIAL_VERIFICATION",
        pathway: pathway,
        senior_citizen_70_plus: isSeniorCitizen,
        has_pmjay_card: hasCard,
        beneficiary_status_reported: beneficiaryStatus,
        aadhaar_available_for_ekyc: aadhaarAvailable,
        message: message,
        next_steps: [
            "Visit the official PM-JAY beneficiary portal.",
            "Check your beneficiary status.",
            "Follow the applicable enrolment and e-KYC instructions.",
            "Contact an authorised Ayushman Mitra or helpdesk if assistance is needed."
        ],
        official_portal: "https://beneficiary.nha.gov.in/",
        disclaimer:
            "This is informational guidance only. GramConnect does not verify beneficiary records or determine official PM-JAY eligibility."
    });
}


        // Other schemes not configured yet
        return res.status(400).json({
            success: false,
            message:
                "Assessment is not configured for this scheme yet."
        });

    } catch (error) {
        console.error("Scheme assessment error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to assess the questionnaire."
        });
    }
});



// Start server
app.listen(PORT, () => {
    console.log(`GramConnect server running on port ${PORT}`);
});
