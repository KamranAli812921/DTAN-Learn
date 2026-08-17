import path from "path";
import dns from "dns";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Some Windows setups leave Node's own resolver pointed at 127.0.0.1 with
// nothing listening there, which breaks the SRV lookup mongodb+srv:// needs
// even though the OS resolver (nslookup, browsers, etc.) works fine. Force
// a real DNS server so the Atlas connection doesn't ECONNREFUSED on querySrv.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models";

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to .env.local before seeding.");
    process.exit(1);
  }

  const username = (process.env.SEED_ADMIN_USERNAME || "admin").toLowerCase();
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@dtanlearn.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";

  console.log(`Connecting to ${uri}...`);
  await mongoose.connect(uri, { dbName: "DTAN-Learn" });

  const existing = await User.findOne({ $or: [{ username }, { email }] });
  if (existing) {
    console.log(`Admin account already exists (username: ${existing.username}, email: ${existing.email}). Skipping.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await User.create({
    username,
    email,
    passwordHash,
    role: "admin",
    status: "active",
  });

  console.log("Admin account created:");
  console.log(`  username: ${admin.username}`);
  console.log(`  email:    ${admin.email}`);
  console.log(`  password: ${password} (change this after first login)`);

  await mongoose.disconnect();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
