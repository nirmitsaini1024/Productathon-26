import "dotenv/config";
import mongoose from "mongoose";
import { sendLeadEmail } from "./email.js";
import { sendWhatsAppTemplateMessage } from "./whatsapp.js";
import { getOfficerModel } from "./api-db.js";

// Mock tender data for testing
const mockTender = {
  reference: "TEST/2026/001",
  title: "Test Tender - Road Construction Project",
  organisation: "Test Department of Public Works",
  keywords: ["bitumen", "road construction"],
  closingDate: "2026-03-15",
  detailUrl: "https://eprocure.gov.in/test/tender/12345",
  publishedDate: "2026-02-08",
};

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

async function testNotifications() {
  console.log("\n🧪 Testing Notification System\n");
  console.log("================================");
  
  // Fetch officers from database
  console.log("Fetching officers from database...");
  const officers = await getOfficers();
  
  if (officers.length === 0) {
    console.error("\n❌ No officers found in database!");
    console.error("   Please add officers first:");
    console.error("   - Via API: POST /api/officers");
    console.error("   - Via UI: Visit /officer-onboarding");
    console.error("\nExample officer data:");
    console.error('   { "name": "John Doe", "email": "john@example.com", "phone": "+919876543210" }');
    process.exit(1);
  }
  
  console.log(`Found ${officers.length} officer(s):\n`);
  officers.forEach((officer, idx) => {
    const phone = officer.phone ? ` | ${officer.phone}` : " | No phone";
    console.log(`   ${idx + 1}. ${officer.name} - ${officer.email}${phone}`);
  });
  
  console.log("\n================================\n");
  console.log("Sending test notifications to all officers...\n");
  
  let emailSuccess = 0;
  let emailFailed = 0;
  let whatsappSuccess = 0;
  let whatsappFailed = 0;
  let whatsappSkipped = 0;
  
  // Test notifications for each officer
  for (const officer of officers) {
    console.log(`\nTesting officer: ${officer.name}`);
    console.log("─".repeat(50));
    
    // Test Email
    if (officer.email) {
      console.log(`Email: ${officer.email}`);
      try {
        const subject = `🧪 TEST: New Tender Alert - ${mockTender.title}`;
        const message = `This is a TEST notification from the Tender Scraper Cron Job.\n\nTender Details:\nCompany: ${mockTender.organisation}\nTags: ${mockTender.keywords.join(", ")}\nTitle: ${mockTender.title}\nClosing Date: ${mockTender.closingDate}\nReference: ${mockTender.reference}\nURL: ${mockTender.detailUrl}`;
        
        const result = await sendLeadEmail({
          to: officer.email,
          subject,
          message,
        });
        
        console.log(`✅ Email sent successfully!`);
        console.log(`   Message ID: ${result.id || result.data?.id || "N/A"}`);
        emailSuccess++;
      } catch (error) {
        console.error(`❌ Email failed: ${error.message}`);
        if (error.statusCode) {
          console.error(`   Status Code: ${error.statusCode}`);
        }
        emailFailed++;
      }
    }
    
    console.log("");
    
    // Test WhatsApp
    if (officer.phone) {
      console.log(`WhatsApp: ${officer.phone}`);
      try {
        const contentVariables = JSON.stringify({
          "1": `🧪 TEST: ${mockTender.title}`,
          "2": mockTender.detailUrl,
        });
        
        const result = await sendWhatsAppTemplateMessage({
          to: officer.phone,
          contentVariables,
        });
        
        console.log(`✅ WhatsApp sent successfully!`);
        console.log(`   Message SID: ${result.sid || "N/A"}`);
        console.log(`   Status: ${result.status || "N/A"}`);
        whatsappSuccess++;
      } catch (error) {
        console.error(`❌ WhatsApp failed: ${error.message}`);
        if (error.status) {
          console.error(`   Status Code: ${error.status}`);
        }
        if (error.twilio) {
          console.error(`   Twilio Error:`, JSON.stringify(error.twilio, null, 2));
        }
        whatsappFailed++;
      }
    } else {
      console.log("⊘ WhatsApp: No phone number provided");
      whatsappSkipped++;
    }
    
    // Small delay between officers
    if (officers.indexOf(officer) < officers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("✅ Test completed!");
  console.log("=".repeat(50));
  console.log("\n📊 Summary:");
  console.log(`   Officers tested: ${officers.length}`);
  console.log(`   Email: ${emailSuccess} ✅ | ${emailFailed} ❌`);
  console.log(`   WhatsApp: ${whatsappSuccess} ✅ | ${whatsappFailed} ❌ | ${whatsappSkipped} ⊘`);
  console.log("\nNote: Check your email and WhatsApp for test messages.");
  console.log("If you didn't receive them, check the error messages above.\n");
  
  // Close MongoDB connection
  await mongoose.disconnect();
}

testNotifications().catch((error) => {
  console.error("\n❌ Test failed with error:");
  console.error(error);
  process.exit(1);
});
