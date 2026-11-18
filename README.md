# ToWallet

Turn barcodes and membership cards into signed Apple Wallet passes.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Screens

- **Add a Card** — read a barcode from an image or photo, edit card info, colour slider, live card preview, add to Apple Wallet
- **Poster style** — no-barcode Membership and Loyalty cards with bundled artwork, using Wallet's Poster Generic style on iOS 27 and a store card fallback on earlier versions
- **Manage Wallet** — list of saved cards

Design system: `#212121` background, `#FF9B5B` accent, `#D2D2FF` upload chip, Be Vietnam Pro.

## Set up Apple Wallet signing

Wallet only installs passes signed with a certificate from a paid Apple Developer account.

1. In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list/passTypeId), create a Pass Type ID such as `pass.com.example.towallet`.
2. Create a private key and certificate signing request. Keep `certs/` private.

   ```bash
   mkdir -p certs
   openssl genrsa -out certs/signer-key.pem 2048
   openssl req -new -key certs/signer-key.pem -out certs/request.csr -subj "/CN=ToWallet"
   ```

3. Create a certificate for the Pass Type ID, upload `certs/request.csr`, and download the result to `certs/pass.cer`.
4. Download the [Apple WWDR G4 certificate](https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer) to `certs/wwdr.cer`, then convert both certificates.

   ```bash
   openssl x509 -inform DER -in certs/pass.cer -out certs/signer-cert.pem
   openssl x509 -inform DER -in certs/wwdr.cer -out certs/wwdr.pem
   ```

5. Create `.env.local`, replacing the Pass Type ID and 10-character Team ID.

   ```bash
   cat > .env.local <<EOF
   PASS_TYPE_IDENTIFIER=pass.com.example.towallet
   PASS_TEAM_IDENTIFIER=ABCDE12345
   PASS_ORGANIZATION_NAME=ToWallet
   PASS_WWDR_CERT_BASE64=$(base64 -i certs/wwdr.pem | tr -d '\n')
   PASS_SIGNER_CERT_BASE64=$(base64 -i certs/signer-cert.pem | tr -d '\n')
   PASS_SIGNER_KEY_BASE64=$(base64 -i certs/signer-key.pem | tr -d '\n')
   EOF
   ```

6. Restart `npm run dev`. Set `PASS_SIGNER_KEY_PASSPHRASE` as well if your key is encrypted.

## Limits

- Wallet can only generate Code 128, QR, PDF417 and Aztec barcodes. Other codes, such as EAN and UPC, are shown on the pass as a cropped image, so test them with a real scanner.
- `/api/pass` signs whatever it receives. Add authentication and rate limiting before deploying it publicly.
