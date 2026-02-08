#!/usr/bin/env node

/**
 * Helper script to add officers to the database
 * 
 * Usage:
 *   node add-officers.js
 * 
 * Or edit the officers array below and run the script.
 */

import "dotenv/config";
import { getOfficerModel } from "./src/api-db.js";
import mongoose from "mongoose";

// Edit this array with your officers
const officers = [
  {
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+919876543210",
    designation: "Senior Procurement Officer",
    region: "North India",
    employee_id: "EMP001"
  },
  {
    name: "Jane Smith",
    email: "jane.smith@example.com",
    phone: "+918888888888",
    designation: "Procurement Manager",
    region: "South India",
    employee_id: "EMP002"
  },
  {
    name: "Bob Wilson",
    email: "bob.wilson@example.com",
    // No phone - will receive only email notifications
    designation: "Tender Analyst",
    region: "East India",
    employee_id: "EMP003"
  },
];

async function addOfficers() {
  console.log("\n📋 Adding Officers to Database\n");
  console.log("================================\n");
  
  try {
    const OfficerModel = await getOfficerModel();
    
    let added = 0;
    let updated = 0;
    let failed = 0;
    
    for (const officer of officers) {
      try {
        const existing = await OfficerModel.findOne({ email: officer.email });
        
        const result = await OfficerModel.findOneAndUpdate(
          { email: officer.email },
          { 
            ...officer, 
            updatedAt: new Date(),
            createdAt: existing ? existing.createdAt : new Date()
          },
          { upsert: true, new: true }
        );
        
        if (existing) {
          console.log(`✓ Updated: ${officer.name} (${officer.email})`);
          updated++;
        } else {
          console.log(`✓ Added: ${officer.name} (${officer.email})`);
          added++;
        }
      } catch (error) {
        console.error(`✗ Failed: ${officer.name} - ${error.message}`);
        failed++;
      }
    }
    
    console.log("\n================================");
    console.log("📊 Summary:");
    console.log(`   Added: ${added}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${added + updated}`);
    console.log("================================\n");
    
    // Show all officers
    const allOfficers = await OfficerModel.find({}).sort({ createdAt: -1 });
    console.log(`\n👥 All Officers in Database (${allOfficers.length}):\n`);
    
    allOfficers.forEach((officer, idx) => {
      const phone = officer.phone ? ` | ${officer.phone}` : "";
      const designation = officer.designation ? ` - ${officer.designation}` : "";
      console.log(`   ${idx + 1}. ${officer.name}${designation}`);
      console.log(`      ${officer.email}${phone}`);
    });
    
    console.log("\n✅ Done!\n");
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the script
addOfficers();
