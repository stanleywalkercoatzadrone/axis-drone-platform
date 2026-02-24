import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'stanley.walker@coatzadroneusa.com',
        pass: 'seuppwncfrpgbumt'
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
