#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Update version and build time before deployment
function updateVersion() {
  const envPath = path.join(__dirname, '../.env.local');
  const buildTime = Date.now().toString();
  
  // Check if .env.local exists (it won't in Vercel)
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env.local not found (likely in production build environment)');
    console.log(`🏗️  Build time: ${new Date(parseInt(buildTime)).toISOString()}`);
    
    // Set environment variables directly for production builds
    process.env.NEXT_PUBLIC_BUILD_TIME = buildTime;
    if (!process.env.NEXT_PUBLIC_APP_VERSION) {
      process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0';
    }
    return;
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Generate new version (increment patch)
  const versionMatch = envContent.match(/NEXT_PUBLIC_APP_VERSION="(\d+)\.(\d+)\.(\d+)"/);
  if (versionMatch) {
    const [, major, minor, patch] = versionMatch;
    const newPatch = parseInt(patch) + 1;
    const newVersion = `${major}.${minor}.${newPatch}`;
    
    envContent = envContent.replace(
      /NEXT_PUBLIC_APP_VERSION="[^"]*"/,
      `NEXT_PUBLIC_APP_VERSION="${newVersion}"`
    );
  }
  
  // Update build time to current timestamp
  envContent = envContent.replace(
    /NEXT_PUBLIC_BUILD_TIME="[^"]*"/,
    `NEXT_PUBLIC_BUILD_TIME="${buildTime}"`
  );
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Version updated successfully');
  console.log(`🏗️  Build time: ${new Date(parseInt(buildTime)).toISOString()}`);
}

// Only run if called directly
if (require.main === module) {
  updateVersion();
}

module.exports = { updateVersion };