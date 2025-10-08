const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');

module.exports = class Email {
  constructor(user, url, token) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.token = token;
    this.from = `MRP Team <${
      process.env.SIB_EMAIL_USERNAME ||
      process.env.EMAIL_USERNAME ||
      'admin@mrp.com'
    }>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'prod') {
      // Sendgrid
      return nodemailer.createTransport({
        host: process.env.SIB_EMAIL_HOST,
        port: process.env.SIB_EMAIL_PORT,
        auth: {
          user: process.env.SIB_EMAIL_USERNAME,
          pass: process.env.SIB_EMAIL_PASSWORD,
        },
      });
    }

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // Send the actual email
  async send(template, subject, attachments, altEmails) {
    // 1) Render HTML based on a pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      token: this.token,
      subject,
    });

    // 2) Define email options
    const mailOptions = {
      from: this.from,
      to: altEmails ? [this.to, ...altEmails] : this.to,
      subject,
      html,
      text: htmlToText.convert(html),
      attachments,
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Thankyou for signing up!');
  }

  async sendSignupOTP() {
    await this.send(
      'signupOtp',
      'Your OTP for registration (valid for only 10 minutes)',
    );
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 minutes)',
    );
  }

  async sendPoster(attachment) {
    await this.send('poster', 'poster generated!!!', attachment);
  }

  async sendExpAccepeted() {
    await this.send('expAccepted', 'Your experience has been accepted!');
  }

  async sendExpRejected() {
    await this.send('expRejected', 'Your experience has been rejected!');
  }
};
