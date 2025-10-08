const { registerFont, createCanvas, loadImage } = require('canvas');
const path = require('path');

registerFont(path.join(__dirname, '../assets/fonts/montserrat.bold.ttf'), {
  family: 'Montserrat Bold',
});
registerFont(path.join(__dirname, '../assets/fonts/montserrat.regular.ttf'), {
  family: 'Montserrat Regular',
});

const getPoster = async (username, rollNum, company, image) => {
  const templatePath = path.join(
    __dirname,
    '../assets',
    'PlacementTemplate.png',
  );
  const templateImage = await loadImage(templatePath);
  const profilePictureImage = await loadImage(image);
  const profilePictureSize = 400;
  const canvas = createCanvas(templateImage.width, templateImage.height);
  const ctx = canvas.getContext('2d');

  let companyFontSize = 84;
  if (company.length > 18 && company.length <= 25) {
    companyFontSize = 64;
  } 
  else if (company.length > 25 && company.length <= 32) {
    companyFontSize = 52;
  }
  else if(company.length > 32) {
    companyFontSize=48;
  }

  const usernameFontSize = 48;
  const rollNumFontSize = 36;

  company = company.toUpperCase();
  username = username.toUpperCase();
  rollNum = rollNum.toUpperCase();

  ctx.drawImage(templateImage, 0, 0);
  ctx.drawImage(
    profilePictureImage,
    340,
    487,
    profilePictureSize,
    profilePictureSize,
  );

  ctx.font = `${companyFontSize}px Montserrat Bold`;
  ctx.fillStyle = 'yellow';
  ctx.textAlign = 'center';
  ctx.fillText(company, canvas.width / 2, 400);

  ctx.font = `${usernameFontSize}px Montserrat Regular`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText(username, canvas.width / 2, 970);

  ctx.font = `${rollNumFontSize}px Montserrat Regular`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText(rollNum, canvas.width / 2, 1020);

  const stream = canvas.createPNGStream();
  const buffer = canvas.toBuffer('image/png');

  return { stream, buffer };
};

module.exports = getPoster;
