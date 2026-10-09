const { notarize } = require('@electron/notarize');
const path = require('path');
const fs = require('fs');

// Helper to parse .env file
function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Remove quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      // Unescape newlines
      value = value.replace(/\\n/g, '\n');
      env[key] = value.trim();
    }
  });
  return env;
}

module.exports = async function (context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Check if we should skip notarization
  if (process.env.SKIP_NOTARIZATION === 'true') {
    console.log('Skipping notarization (SKIP_NOTARIZATION is set to true)');
    return;
  }

  const appName = context.packager.appInfo.productName;
  const appPath = path.join(appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot find application at: ${appPath}`);
  }

  // Load environment variables from .env files
  const rootEnv = loadEnv(path.join(__dirname, '../../.env'));
  const localEnv = loadEnv(path.join(__dirname, '../.env'));
  const electronEnv = loadEnv(path.join(__dirname, '../electron.env'));

  const env = {
    ...rootEnv,
    ...localEnv,
    ...electronEnv,
    ...process.env
  };

  const appleId = env.APPLE_ID;
  const appleIdPassword = env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = env.APPLE_TEAM_ID;

  const appleApiKey = env.APPLE_API_KEY;
  const appleApiKeyId = env.APPLE_API_KEY_ID;
  const appleApiIssuer = env.APPLE_API_ISSUER;
  const applePrivateKey = env.APPLE_PRIVATE_KEY;

  let notarizeConfig = null;

  if (appleApiKeyId && appleApiIssuer && (applePrivateKey || appleApiKey)) {
    console.log('Configuring notarization using App Store Connect API Key...');
    let apiKeyPath = appleApiKey;

    // If private key content is provided in env, write it to a temp file
    let tempKeyPath = null;
    if (applePrivateKey && !appleApiKey) {
      tempKeyPath = path.join(__dirname, `../AuthKey_${appleApiKeyId}.p8`);
      fs.writeFileSync(tempKeyPath, applePrivateKey, 'utf8');
      apiKeyPath = tempKeyPath;
      console.log(`Created temporary API key file at: ${tempKeyPath}`);
    }

    notarizeConfig = {
      appPath,
      appleApiKey: apiKeyPath,
      appleApiKeyId,
      appleApiIssuer,
    };

    // Store tempKeyPath on context so we can clean it up after notarization
    context.tempKeyPath = tempKeyPath;
  } else if (appleId && appleIdPassword && teamId) {
    console.log('Configuring notarization using Apple ID and App-Specific Password...');
    notarizeConfig = {
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    };
  } else {
    console.warn('⚠️  Skipping macOS notarization: Missing credentials.');
    console.warn('To enable notarization, please define either:');
    console.warn('Option A (API Key): APPLE_API_KEY_ID, APPLE_API_ISSUER, and (APPLE_PRIVATE_KEY or APPLE_API_KEY path)');
    console.warn('Option B (Apple ID): APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID');
    return;
  }

  try {
    console.log(`Starting notarization for ${appName}...`);
    await notarize(notarizeConfig);
    console.log(`✅ Success: ${appName} has been notarized!`);
  } catch (error) {
    console.error(`❌ Notarization failed: ${error.message}`);
    throw error;
  } finally {
    // Clean up temporary API key file if it was created
    if (context.tempKeyPath && fs.existsSync(context.tempKeyPath)) {
      fs.unlinkSync(context.tempKeyPath);
      console.log(`Cleaned up temporary API key file: ${context.tempKeyPath}`);
    }
  }
};
