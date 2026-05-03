import nodemailer from 'nodemailer';

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('SMTP_USER and SMTP_PASS environment variables are required.');
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function verify() {
    console.log('Testing SMTP connection...');
    try {
        await transporter.verify();
        console.log('✅ Connection Successful! Credentials are valid.');
    } catch (error) {
        console.error('❌ Connection Failed:');
        console.error(error.message);
        if (error.code === 'EAUTH') {
            console.log('\n💡 DIAGNOSIS: Authentication Failed.');
            console.log('   - If you are using your main Google password, you likely need an "App Password".');
            console.log('   - Go to Google Account > Security > 2-Step Verification > App Passwords.');
        }
    }
}

verify();
