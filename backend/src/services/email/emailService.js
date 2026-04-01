const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/* -------------------- VERIFY SMTP -------------------- */
async function verifySMTP() {
  try {
    await transporter.verify();
    console.log('✅ SMTP server ready (Gmail)');
  } catch (err) {
    console.error('❌ SMTP connection failed:', err.message);
  }
}

verifySMTP();

/* -------------------- CORE MAIL FUNCTION -------------------- */
async function sendMail(options) {
  try {
    const info = await transporter.sendMail({
      from: `"InstaHire" <${process.env.EMAIL_FROM}>`,
      ...options
    });
    console.log(`📧 Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    throw error;
  }
}

/* -------------------- OTP EMAIL -------------------- */
exports.sendOTPEmail = async (email, otp) => {
  return sendMail({
    to: email,
    subject: 'InstaHire - Verify Your Email',
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #9333ea); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">InstaHire</h1>
        </div>
        <div style="background: #f8fafc; padding: 40px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1e293b;">Verify Your Email</h2>
          <p style="color: #64748b;">Use the OTP below. It expires in 10 minutes.</p>
          <div style="background: white; border: 2px dashed #2563eb; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 13px;">If you did not request this, please ignore this email.</p>
        </div>
      </div>
    `
  });
};

/* -------------------- WELCOME EMAIL -------------------- */
exports.sendWelcomeEmail = async (email, name) => {
  return sendMail({
    to: email,
    subject: 'Welcome to InstaHire 🎉',
    text: `Welcome ${name}! Start exploring jobs.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #9333ea); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome to InstaHire!</h1>
        </div>
        <div style="background: #f8fafc; padding: 40px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1e293b;">Hi ${name} 👋</h2>
          <p style="color: #64748b;">Your account is ready. Start exploring jobs!</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobs"
            style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
            Browse Jobs
          </a>
        </div>
      </div>
    `
  });
};

/* -------------------- APPLICATION EMAIL -------------------- */
exports.sendApplicationEmail = async (email, jobTitle) => {
  return sendMail({
    to: email,
    subject: `Application Submitted - ${jobTitle}`,
    text: `Your application for ${jobTitle} has been submitted.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #9333ea); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Application Submitted!</h1>
        </div>
        <div style="background: #f8fafc; padding: 40px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1e293b;">You applied for ${jobTitle} ✅</h2>
          <p style="color: #64748b;">Your application has been submitted successfully.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/applications"
            style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
            View Applications
          </a>
        </div>
      </div>
    `
  });
};

/* -------------------- INTERVIEW EMAIL -------------------- */
exports.sendInterviewInvite = async (email, details) => {
  return sendMail({
    to: email,
    subject: 'Interview Scheduled - InstaHire 📅',
    text: `Your interview is scheduled at ${details.scheduledAt}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #2563eb); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Interview Scheduled! 📅</h1>
        </div>
        <div style="background: #f8fafc; padding: 40px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1e293b;">Your interview has been scheduled</h2>
          <div style="background: white; border-radius: 12px; padding: 20px; margin: 16px 0;">
            <p style="color: #64748b; margin: 4px 0;"><strong>Date & Time:</strong> ${new Date(details.scheduledAt).toLocaleString()}</p>
            <p style="color: #64748b; margin: 4px 0;"><strong>Type:</strong> ${details.type || 'In-person'}</p>
            ${details.notes ? `<p style="color: #64748b; margin: 4px 0;"><strong>Notes:</strong> ${details.notes}</p>` : ''}
          </div>
          <p style="color: #94a3b8; font-size: 13px;">Please be on time. All the best!</p>
        </div>
      </div>
    `
  });
};

/* -------------------- STATUS EMAIL -------------------- */
exports.sendStatusUpdate = async (email, jobTitle, status) => {
  const statusMessages = {
    shortlisted: { emoji: '⭐', text: 'You have been shortlisted!', color: '#f59e0b' },
    hired: { emoji: '🎉', text: 'Congratulations! You are hired!', color: '#10b981' },
    rejected: { emoji: '❌', text: 'Your application was not selected.', color: '#ef4444' }
  };

  const statusInfo = statusMessages[status] || { emoji: '📋', text: `Status updated to ${status}`, color: '#2563eb' };

  return sendMail({
    to: email,
    subject: `Application Update - ${jobTitle}`,
    text: `Your application status for ${jobTitle} is now ${status}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${statusInfo.color}; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">${statusInfo.emoji} ${statusInfo.text}</h1>
        </div>
        <div style="background: #f8fafc; padding: 40px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1e293b;">Update for ${jobTitle}</h2>
          <p style="color: #64748b;">${statusInfo.text}</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/applications"
            style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
            View Applications
          </a>
        </div>
      </div>
    `
  });
};