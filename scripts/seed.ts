import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

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
  await mongoose.connect(uri);

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
