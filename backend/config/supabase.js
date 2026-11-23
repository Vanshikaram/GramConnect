
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend environment variables
dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing!");
}

const supabase = createClient(
    supabaseUrl,
    supabaseKey
);

console.log("Supabase client initialized in backend!");

export default supabase;

