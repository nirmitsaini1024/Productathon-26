import "dotenv/config";
import cron from "node-cron";
import { exec } from "child_process";
import { promisify } from "util";
import mongoose from "mongoose";
import { sendLeadEmail } from "./email.js";
import { sendWhatsAppTemplateMessage } from "./whatsapp.js";
import { safeFilename } from "./utils.js";
import { getOfficerModel } from "./api-db.js";

const execAsync = promisify(exec);

// Configuration from environment
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/30 * * * *"; // Default: every 30 minutes
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB;
const MONGO_COLLECTION = process.env.MONGO_COLLECTION || "tenders";

// Validate configuration
function validateConfig() {
  const errors = [];
  
  if (!MONGO_URI) errors.push("MONGO_URI is not set");
  
  if (errors.length > 0) {
    console.error("Configuration errors:");
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
}

// Connect to MongoDB
async function connectMongo() {
  if (mongoose.connection?.readyState === 1) return mongoose;
  await mongoose.connect(MONGO_URI, MONGO_DB ? { dbName: MONGO_DB } : {});
  return mongoose;
}

// Get Tender Model
function getTenderModel() {
  const { Schema } = mongoose;
  
  // Try to get existing model or create new one
  if (mongoose.models[`Tender__${MONGO_COLLECTION}`]) {
    return mongoose.models[`Tender__${MONGO_COLLECTION}`];
  }
  
  const tenderSchema = new Schema(
    {
      key: { type: String, required: true },
      source: { type: String, default: "eprocure" },
      reference: { type: String, default: null },
      detailUrl: { type: String, default: null },
      keywords: { type: [String], default: [] },
      createdAt: { type: Date, default: Date.now },
      firstSeenAt: { type: Date, default: Date.now },
      lastSeenAt: { type: Date, default: Date.now },
      lastKeyword: { type: String, default: null },
      updatedAt: { type: Date, default: Date.now },
    },
    {
      strict: false,
      minimize: false,
    }
  );
  
  tenderSchema.index({ key: 1 }, { unique: true, name: "uniq_key" });
  
  return mongoose.model(`Tender__${MONGO_COLLECTION}`, tenderSchema, MONGO_COLLECTION);
}

// Function to generate tender key
function tenderKey(t) {
  return `${t?.reference || ""}::${t?.detailUrl || ""}`.trim();
}

// Format tender details for notification
function formatTenderDetails(tender) {
  const details = [];
  
  // Company/Organization name
  if (tender.organisation) {
    details.push(`Company: ${tender.organisation}`);
  }
  
  // Tag/Keyword
  if (tender.keywords && tender.keywords.length > 0) {
    details.push(`Tags: ${tender.keywords.join(", ")}`);
  } else if (tender.keyword) {
    details.push(`Tag: ${tender.keyword}`);
  }
  
  // Title
  if (tender.title) {
    details.push(`Title: ${tender.title}`);
  }
  
  // Closing Date
  if (tender.closingDate) {
    details.push(`Closing Date: ${tender.closingDate}`);
  }
  
  // Reference
  if (tender.reference) {
    details.push(`Reference: ${tender.reference}`);
  }
  
  // URL
  if (tender.detailUrl) {
    details.push(`URL: ${tender.detailUrl}`);
  }
  
  return details.join("\n");
}

// Get all officers from database
async function getOfficers() {
  try {
    const OfficerModel = await getOfficerModel();
    const officers = await OfficerModel.find({}).lean();
    return officers;
  } catch (error) {
    console.error("Failed to fetch officers:", error.message);
    return [];
  }
}

// Send email notification to an officer for new tender
async function sendEmailNotification(tender, officer) {
  try {
    if (!officer.email) {
      console.log(`  ⊘ Skipping email for ${officer.name} (no email)`);
      return;
    }
    
    const subject = `New Tender Alert: ${tender.title || tender.reference || "Tender"}`;
    const message = `A new tender has been found!\n\n${formatTenderDetails(tender)}`;
    
    await sendLeadEmail({
      to: officer.email,
      subject,
      message,
    });
    
    console.log(`  ✓ Email sent to ${officer.name} (${officer.email})`);
  } catch (error) {
    console.error(`  ✗ Email failed for ${officer.name}:`, error.message);
  }
}

// Send WhatsApp notification to an officer for new tender
async function sendWhatsAppNotification(tender, officer) {
  try {
    if (!officer.phone) {
      console.log(`  ⊘ Skipping WhatsApp for ${officer.name} (no phone)`);
      return;
    }
    
    // Format content variables for WhatsApp template
    const title = tender.title || tender.reference || "New Tender";
    const url = tender.detailUrl || "No URL available";
    
    const contentVariables = JSON.stringify({
      "1": title.substring(0, 100), // Limit length for WhatsApp
      "2": url,
    });
    
    await sendWhatsAppTemplateMessage({
      to: officer.phone,
      contentVariables,
    });
    
    console.log(`  ✓ WhatsApp sent to ${officer.name} (${officer.phone})`);
  } catch (error) {
    console.error(`  ✗ WhatsApp failed for ${officer.name}:`, error.message);
  }
}

// Main scraping and notification logic
async function runScrapingJob() {
  const startTime = Date.now();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${new Date().toISOString()}] Starting scheduled scrape...`);
  console.log(`${"=".repeat(60)}\n`);
  
  try {
    // Connect to MongoDB
    await connectMongo();
    const TenderModel = getTenderModel();
    
    // Get existing tender IDs before scraping
    console.log("Fetching existing tenders from database...");
    const existingTenderKeys = new Set();
    const existingTenders = await TenderModel.find({}, { key: 1 }).lean();
    existingTenders.forEach(t => {
      if (t.key) existingTenderKeys.add(t.key);
    });
    console.log(`Found ${existingTenderKeys.size} existing tenders in database\n`);
    
    // Run the scraper
    console.log("Running scraper (node src/index.js)...");
    const { stdout, stderr } = await execAsync("node src/index.js", {
      cwd: process.cwd(),
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    
    if (stdout) console.log(stdout);
    if (stderr) console.error("Scraper stderr:", stderr);
    
    console.log("\nScraping completed. Checking for new tenders...\n");
    
    // Fetch all tenders from database after scraping
    const allTenders = await TenderModel.find({}).sort({ createdAt: -1 }).lean();
    
    // Identify new tenders (those that weren't in the existing set)
    const newTenders = allTenders.filter(tender => 
      tender.key && !existingTenderKeys.has(tender.key)
    );
    
    console.log(`Found ${newTenders.length} new tender(s)\n`);
    
    // Send notifications for each new tender
    if (newTenders.length > 0) {
      // Fetch all officers from database
      console.log("Fetching officers from database...");
      const officers = await getOfficers();
      
      if (officers.length === 0) {
        console.log("⚠️  No officers found in database. No notifications sent.");
        console.log("   Add officers via: POST /api/officers or visit /officer-onboarding\n");
      } else {
        console.log(`Found ${officers.length} officer(s) to notify\n`);
        
        console.log("Sending notifications for new tenders...\n");
        
        for (const tender of newTenders) {
          console.log(`\nProcessing tender: ${tender.reference || tender.title}`);
          console.log(`Notifying ${officers.length} officer(s)...`);
          
          // Send notifications to each officer
          for (const officer of officers) {
            console.log(`\n  Officer: ${officer.name} (${officer.designation || "No designation"})`);
            
            // Send both email and WhatsApp notifications
            await Promise.allSettled([
              sendEmailNotification(tender, officer),
              sendWhatsAppNotification(tender, officer),
            ]);
            
            // Small delay between officers to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          // Delay between tenders
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`\n✓ Notifications sent to ${officers.length} officer(s) for ${newTenders.length} new tender(s)`);
      }
    } else {
      console.log("No new tenders found. No notifications sent.");
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[${new Date().toISOString()}] Job completed in ${duration}s`);
    console.log(`${"=".repeat(60)}\n`);
    
  } catch (error) {
    console.error("\n❌ Error during scraping job:", error.message);
    console.error(error.stack);
  }
}

// Start cron job
async function startCronJob() {
  validateConfig();
  
  console.log("\n🚀 Tender Scraper Cron Job Started");
  console.log(`   Schedule: ${CRON_SCHEDULE}`);
  console.log(`   MongoDB: ${MONGO_URI.replace(/:[^:@]+@/, ':****@')}`);
  
  // Show current officers count
  try {
    const officers = await getOfficers();
    console.log(`   Officers: ${officers.length} registered`);
    if (officers.length > 0) {
      console.log(`   Recipients:`);
      officers.forEach((officer, idx) => {
        const phone = officer.phone ? ` | ${officer.phone}` : "";
        console.log(`     ${idx + 1}. ${officer.name} - ${officer.email}${phone}`);
      });
    } else {
      console.log(`   ⚠️  No officers registered yet!`);
      console.log(`   Add officers at: POST /api/officers or visit /officer-onboarding`);
    }
  } catch (error) {
    console.log(`   ⚠️  Could not fetch officers: ${error.message}`);
  }
  
  console.log("\n⏰ Waiting for scheduled runs...\n");
  
  // Validate cron expression
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`Invalid cron schedule: ${CRON_SCHEDULE}`);
    process.exit(1);
  }
  
  // Schedule the job
  const task = cron.schedule(CRON_SCHEDULE, async () => {
    await runScrapingJob();
  });
  
  task.start();
  
  // Optional: Run immediately on startup (comment out if not desired)
  if (process.env.RUN_ON_STARTUP === "1") {
    console.log("RUN_ON_STARTUP=1: Running initial scrape now...\n");
    runScrapingJob().catch(err => {
      console.error("Initial run failed:", err);
    });
  }
  
  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Stopping cron job...");
    task.stop();
    mongoose.disconnect();
    process.exit(0);
  });
  
  process.on("SIGTERM", () => {
    console.log("\n\n🛑 Stopping cron job...");
    task.stop();
    mongoose.disconnect();
    process.exit(0);
  });
}

// Start the cron job
startCronJob();
