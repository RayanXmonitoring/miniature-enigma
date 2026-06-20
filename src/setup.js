require('dotenv').config();
const { TelegramClient } = require('gramjs');
const { StringSession } = require('gramjs/sessions');
const input = require('input');

async function setup() {
  const client = new TelegramClient(
    new StringSession(''),
    parseInt(process.env.API_ID),
    process.env.API_HASH,
    { connectionRetries: 5 }
  );

  await client.start({
    phoneNumber: async () => process.env.PHONE_NUMBER,
    password: async () => await input.text('Password? (if any): '),
    phoneCode: async () => await input.text('Enter verification code: '),
    onError: (err) => console.log(err),
  });

  console.log('✅ Login successful!');
  
  // Save session
  const sessionString = client.session.save();
  console.log('\n📝 Session String:');
  console.log(sessionString);
  console.log('\n💾 Save this session string in your .env file as SESSION_STRING');
  
  await client.disconnect();
}

setup().catch(console.error);
