const { auth, drive } = require('@googleapis/drive');

class Drive {
  /**
   *
   * @param {String} keyFilename Path to the credentials file
   * @param {[String]} scopes Scopes to be used by the drive service. default: ['https://www.googleapis.com/auth/drive']
   *
   * This class is used to interact with the Google Drive API. It uses service accounts for authentication.
   *
   * @example const testDrive = new Drive(path.join(__dirname, 'drive-creds.json'), ['https://www.googleapis.com/auth/drive']);
   */

  constructor(keyFilename, scopes = ['https://www.googleapis.com/auth/drive']) {
    this.auth = new auth.GoogleAuth({
      keyFilename,
      scopes,
    });

    this.driveService = drive({ version: 'v3', auth: this.auth });
  }

  async listFilesByName(filename) {
    const res = await this.driveService.files.list({
      q: `name = '${filename}'`,
    });
    const { files } = res.data;
    return {
      count: files.length,
      files,
    };
  }

  async uploadFile(file, folderId) {
    const response = await this.driveService.files.create({
      requestBody: {
        name: file.name,
        mimeType: file.mimeType,
        parents: [folderId],
      },
      media: {
        mimeType: file.mimeType,
        body: file.stream,
      },
      fields: 'id, name',
    });
    return response.data;
  }
}

module.exports = Drive;
