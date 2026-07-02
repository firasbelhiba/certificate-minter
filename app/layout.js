import "./globals.css";

export const metadata = {
  title: "Hedera Course Certificates",
  description: "Mint end-of-course certificates as NFTs on Hedera",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
