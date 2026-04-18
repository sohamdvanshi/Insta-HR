const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function verifySMTP() {
  try {
    await transporter.verify();
    console.log('✅ SMTP server ready (Gmail)');
  } catch (err) {
    console.error('❌ SMTP connection failed:', err.message);
  }
}

verifySMTP();

function wrapTemplate({ title, content }) {
  return `
    <div style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:22px 24px;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">InstaHire</h1>
            <p style="margin:6px 0 0;color:#dbeafe;font-size:13px;">Hiring platform notifications</p>
          </div>

          <div style="padding:28px 24px;">
            <h2 style="margin:0 0 18px;font-size:22px;color:#111827;">${title}</h2>
            <div style="font-size:15px;line-height:1.7;color:#374151;">
              ${content}
            </div>
          </div>

          <div style="padding:18px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#6b7280;">
              This is an automated email from InstaHire. Please do not reply directly to this message.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function sendMail(options) {
  try {
    const info = await transporter.sendMail({
      from: `"InstaHire" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      ...options
    });
    console.log(`📧 Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    throw error;
  }
}

exports.sendTestEmail = async email => {
  return sendMail({
    to: email,
    subject: 'InstaHire - Test Email',
    text: 'If you received this, your Gmail SMTP setup is working correctly.',
    html: wrapTemplate({
      title: 'SMTP Test Successful',
      content: `
        <p>Hello,</p>
        <p>If you received this message, your InstaHire email configuration is working correctly.</p>
        <p>You can now send OTPs, interview notifications, application updates, and subscription reminders.</p>
        <p>— Team InstaHire</p>
      `
    })
  });
};

exports.sendOTPEmail = async (email, otp) => {
  return sendMail({
    to: email,
    subject: 'InstaHire - Verify Your Email',
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
    html: wrapTemplate({
      title: 'Verify Your Email',
      content: `
        <p>Your OTP is:</p>
        <div style="margin:18px 0;padding:16px;background:#eff6ff;border:1px dashed #93c5fd;border-radius:10px;text-align:center;">
          <div style="font-size:32px;letter-spacing:6px;font-weight:700;color:#1d4ed8;">${otp}</div>
        </div>
        <p>It expires in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `
    })
  });
};

exports.sendInterviewScheduledEmail = async (email, details) => {
  const formattedDate = details?.scheduledAt
    ? new Date(details.scheduledAt).toLocaleString('en-IN')
    : 'To be confirmed';

  const candidateName = details?.candidateName || 'Candidate';
  const jobTitle = details?.jobTitle || 'Job Interview';
  const companyName = details?.companyName || 'InstaHire Employer';
  const mode = details?.mode === 'online' ? 'Online' : 'In-person';

  const locationOrLink =
    details?.mode === 'online'
      ? details?.meetingLink || 'Will be shared soon'
      : details?.location || 'Will be shared soon';

  return sendMail({
    to: email,
    subject: `Interview Scheduled - ${jobTitle}`,
    text: `
Hello ${candidateName},

Your interview has been scheduled.

Job Title: ${jobTitle}
Company: ${companyName}
Date & Time: ${formattedDate}
Mode: ${mode}
${details?.mode === 'online' ? `Meeting Link: ${locationOrLink}` : `Location: ${locationOrLink}`}
Notes: ${details?.notes || 'Please be available on time.'}

Please check your application dashboard for updates.

Best of luck,
InstaHire
    `.trim(),
    html: wrapTemplate({
      title: 'Interview Scheduled',
      content: `
        <p>Hello ${candidateName},</p>
        <p>Your interview has been scheduled successfully.</p>

        <p><strong>Job Title:</strong> ${jobTitle}</p>
        <p><strong>Company:</strong> ${companyName}</p>
        <p><strong>Date & Time:</strong> ${formattedDate}</p>
        <p><strong>Mode:</strong> ${mode}</p>
        ${
          details?.mode === 'online'
            ? `<p><strong>Meeting Link:</strong> ${locationOrLink}</p>`
            : `<p><strong>Location:</strong> ${locationOrLink}</p>`
        }
        <p><strong>Notes:</strong> ${details?.notes || 'Please be available on time.'}</p>

        <p>Please check your application dashboard for updates.</p>
        <p>Best of luck,<br/>InstaHire</p>
      `
    })
  });
};

exports.sendApplicationStatusEmail = async (email, details) => {
  const candidateName = details?.candidateName || 'Candidate';
  const jobTitle = details?.jobTitle || 'your application';
  const status = (details?.status || 'updated').toLowerCase();

  const statusMap = {
    shortlisted: {
      subject: `You have been shortlisted - ${jobTitle}`,
      text: `Congratulations! You have been shortlisted for ${jobTitle}.`,
      heading: 'You Have Been Shortlisted'
    },
    interview: {
      subject: `Interview update - ${jobTitle}`,
      text: `Your application for ${jobTitle} has moved to the interview stage.`,
      heading: 'Interview Stage Update'
    },
    hired: {
      subject: `Offer update - ${jobTitle}`,
      text: `Congratulations! You have been selected for ${jobTitle}.`,
      heading: 'Congratulations'
    },
    rejected: {
      subject: `Application update - ${jobTitle}`,
      text: `Thank you for applying. Your application for ${jobTitle} was not selected this time.`,
      heading: 'Application Update'
    }
  };

  const selected = statusMap[status] || {
    subject: `Application status updated - ${jobTitle}`,
    text: `Your application status for ${jobTitle} has been updated to ${status}.`,
    heading: 'Application Status Updated'
  };

  return sendMail({
    to: email,
    subject: selected.subject,
    text: `
Hello ${candidateName},

${selected.text}

Status: ${status}

Best regards,
InstaHire
    `.trim(),
    html: wrapTemplate({
      title: selected.heading,
      content: `
        <p>Hello ${candidateName},</p>
        <p>${selected.text}</p>
        <p><strong>Status:</strong> ${status}</p>
        <p>Best regards,<br/>InstaHire</p>
      `
    })
  });
};

exports.sendSubscriptionReminder7Days = async user => {
  const expiryDate = user?.subscriptionExpiry
    ? new Date(user.subscriptionExpiry).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : 'soon';

  return sendMail({
    to: user.email,
    subject: 'Your InstaHire subscription expires in 7 days',
    text: `
Hello ${user.name || 'Employer'},

Your ${user.subscriptionPlan} plan will expire on ${expiryDate}.

Renew now to continue using premium features on InstaHire.

Renew here: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription

Best regards,
InstaHire
    `.trim(),
    html: wrapTemplate({
      title: 'Subscription Expiry Reminder',
      content: `
        <p>Hello ${user.name || 'Employer'},</p>
        <p>Your <strong>${user.subscriptionPlan}</strong> plan will expire on <strong>${expiryDate}</strong>.</p>
        <p>Renew now to continue using premium features like featured jobs, advanced employer tools, and better hiring visibility.</p>
        <p style="margin-top:20px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription"
             style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
             Renew Subscription
          </a>
        </p>
        <p style="margin-top:18px;">— Team InstaHire</p>
      `
    })
  });
};

exports.sendSubscriptionReminder1Day = async user => {
  const expiryDate = user?.subscriptionExpiry
    ? new Date(user.subscriptionExpiry).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : 'tomorrow';

  return sendMail({
    to: user.email,
    subject: 'Your InstaHire subscription expires tomorrow',
    text: `
Hello ${user.name || 'Employer'},

Your ${user.subscriptionPlan} plan expires tomorrow on ${expiryDate}.

Renew now to avoid losing premium access.

Renew here: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription

Best regards,
InstaHire
    `.trim(),
    html: wrapTemplate({
      title: 'Subscription Expires Tomorrow',
      content: `
        <p>Hello ${user.name || 'Employer'},</p>
        <p>Your <strong>${user.subscriptionPlan}</strong> plan expires tomorrow on <strong>${expiryDate}</strong>.</p>
        <p>Renew now to avoid losing premium features like featured listings and advanced employer tools.</p>
        <p style="margin-top:20px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription"
             style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
             Renew Now
          </a>
        </p>
        <p style="margin-top:18px;">— Team InstaHire</p>
      `
    })
  });
};

exports.sendSubscriptionExpiredEmail = async user => {
  return sendMail({
    to: user.email,
    subject: 'Your InstaHire subscription has expired',
    text: `
Hello ${user.name || 'Employer'},

Your InstaHire ${user.subscriptionPlan} subscription has expired.

Your account has now been moved to the Free plan.
You can upgrade anytime here:
${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription

Best regards,
InstaHire
    `.trim(),
    html: wrapTemplate({
      title: 'Subscription Expired',
      content: `
        <p>Hello ${user.name || 'Employer'},</p>
        <p>Your InstaHire <strong>${user.subscriptionPlan}</strong> subscription has expired.</p>
        <p>Your account has now been moved to the <strong>Free</strong> plan. You can upgrade anytime to restore premium benefits.</p>
        <p style="margin-top:20px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription"
             style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
             Upgrade Again
          </a>
        </p>
        <p style="margin-top:18px;">— Team InstaHire</p>
      `
    })
  });
};

exports.sendBulkCampaignEmail = async ({
  to,
  candidateName,
  subject,
  message,
  jobTitle,
  companyName
}) => {
  const safeMessage = String(message || '').replace(/\n/g, '<br/>');

  return sendMail({
    to,
    subject,
    text: `
Hello ${candidateName || 'Candidate'},

${message}

Job: ${jobTitle || 'Opportunity'}
Company: ${companyName || 'InstaHire Employer'}

Best regards,
InstaHire
    `.trim(),
    html: wrapTemplate({
      title: subject,
      content: `
        <p>Hello ${candidateName || 'Candidate'},</p>
        <p>${safeMessage}</p>
        <p><strong>Job:</strong> ${jobTitle || 'Opportunity'}</p>
        <p><strong>Company:</strong> ${companyName || 'InstaHire Employer'}</p>
        <p>Best regards,<br/>InstaHire</p>
      `
    })
  });
};

exports.sendWelcomeEmail = async (email, name) => {
  return sendMail({
    to: email,
    subject: 'Welcome to InstaHire',
    text: `
Hello ${name || 'User'},

Welcome to InstaHire.

Your account has been created successfully and your email has been verified.
You can now explore jobs, hiring tools, training, and platform features.

Best regards,
InstaHire
    `.trim(),
    html: wrapTemplate({
      title: 'Welcome to InstaHire',
      content: `
        <p>Hello ${name || 'User'},</p>
        <p>Welcome to <strong>InstaHire</strong>.</p>
        <p>Your account has been created successfully and your email has been verified.</p>
        <p>You can now start using the platform based on your role.</p>
        <p style="margin-top:18px;">Best regards,<br/>InstaHire</p>
      `
    })
  });
};

exports.sendMail = sendMail;
exports.verifySMTP = verifySMTP;