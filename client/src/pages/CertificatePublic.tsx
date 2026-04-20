/**
 * Public certificate page — accessible without login via /certificate/:uuid
 * Renders the certificate in the Fascia Academy gold/white design.
 * Allows downloading as PDF via browser print.
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2, AlertTriangle } from "lucide-react";

const GOLD = "#C8A96A";
const DARK = "#1A1A2E";

function CertificateRender({
  cert,
  template,
}: {
  cert: {
    contactName: string;
    courseType: string;
    language: string;
    issuedAt: Date | string;
    verificationCode?: string | null;
  };
  template: {
    title: string;
    courseLabel: string;
    bodyText: string;
    bulletPoints?: string | null;
    instructorName: string;
    instructorTitle: string;
    faLogoUrl?: string | null;
    atlasLogoUrl?: string | null;
  } | null;
}) {
  const lang = cert.language === "en" ? "en" : "sv";
  const title = template?.title ?? (lang === "sv" ? "INTYG" : "CERTIFICATE");
  const courseLabel = template?.courseLabel ?? cert.courseType.toUpperCase();
  const bodyText = template?.bodyText ?? "";
  const bullets: string[] = (() => {
    try {
      return template?.bulletPoints ? JSON.parse(template.bulletPoints) : [];
    } catch {
      return [];
    }
  })();
  const instructorName = template?.instructorName ?? "Ivar Bohlin";
  const instructorTitle = template?.instructorTitle ?? "Ansvarig lärare Ivar Bohlin";
  const faLogo = template?.faLogoUrl ?? "/manus-storage/fa-logo_9f3873fa.png";
  const atlasLogo = template?.atlasLogoUrl ?? "/manus-storage/atlasbalans-logo_3f37aa31.png";

  const issuedDate = new Date(cert.issuedAt).toLocaleDateString(
    lang === "sv" ? "sv-SE" : "en-GB",
    { day: "numeric", month: "numeric", year: "numeric" }
  );

  return (
    <div
      id="certificate-content"
      style={{
        background: GOLD,
        padding: "32px",
        borderRadius: "8px",
        maxWidth: "680px",
        margin: "0 auto",
        fontFamily: "'Georgia', serif",
      }}
    >
      {/* Inner white panel */}
      <div
        style={{
          background: "#fff",
          borderRadius: "6px",
          padding: "48px 56px",
          textAlign: "center",
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontSize: "36px",
            fontWeight: "bold",
            color: GOLD,
            letterSpacing: "4px",
            margin: "0 0 24px 0",
            fontFamily: "'Georgia', serif",
          }}
        >
          {title}
        </h1>

        {/* Participant name */}
        <div
          style={{
            borderBottom: `1px solid ${DARK}`,
            marginBottom: "8px",
            paddingBottom: "4px",
          }}
        >
          <p
            style={{
              fontSize: "26px",
              fontStyle: "italic",
              color: DARK,
              margin: "0",
              fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
            }}
          >
            {cert.contactName}
          </p>
        </div>

        {/* Course label */}
        <h2
          style={{
            fontSize: "22px",
            fontWeight: "bold",
            color: DARK,
            margin: "16px 0 4px 0",
            fontFamily: "'Georgia', serif",
          }}
        >
          {courseLabel}
        </h2>

        <p style={{ fontSize: "14px", color: "#555", margin: "0 0 20px 0" }}>
          By Fascia Academy
        </p>

        {/* Body text */}
        {bodyText && (
          <p
            style={{
              fontSize: "13px",
              color: DARK,
              lineHeight: "1.6",
              margin: "0 0 16px 0",
              textAlign: "left",
            }}
          >
            {bodyText}
          </p>
        )}

        {/* Bullet points */}
        {bullets.length > 0 && (
          <div style={{ textAlign: "left", marginBottom: "20px" }}>
            <p style={{ fontSize: "13px", fontWeight: "bold", color: DARK, margin: "0 0 8px 0" }}>
              {lang === "sv" ? "En godkänd elev:" : "A qualified graduate:"}
            </p>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              {bullets.map((b, i) => (
                <li key={i} style={{ fontSize: "13px", color: DARK, lineHeight: "1.6", marginBottom: "4px" }}>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Date */}
        <div style={{ textAlign: "left", marginBottom: "24px" }}>
          <p style={{ fontSize: "13px", color: DARK, margin: 0 }}>
            <strong>{lang === "sv" ? "Datum" : "Date"}</strong>{" "}
            <span
              style={{
                borderBottom: `1px solid ${DARK}`,
                paddingBottom: "2px",
                fontStyle: "italic",
              }}
            >
              {issuedDate}
            </span>
          </p>
        </div>

        {/* Signature */}
        <div style={{ textAlign: "left", borderBottom: `1px solid ${DARK}`, paddingBottom: "4px", marginBottom: "4px", maxWidth: "200px" }}>
          <p
            style={{
              fontSize: "20px",
              fontStyle: "italic",
              color: DARK,
              margin: 0,
              fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
            }}
          >
            {instructorName}
          </p>
        </div>
        <p style={{ fontSize: "12px", fontWeight: "bold", color: DARK, margin: "0 0 24px 0", textAlign: "left" }}>
          {instructorTitle}
        </p>

        {/* Verification code */}
        {cert.verificationCode && (
          <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: "12px", marginTop: "4px" }}>
            <p style={{ fontSize: "10px", color: "#888", margin: 0, textAlign: "center", letterSpacing: "0.5px" }}>
              {lang === "sv" ? "Verifikationsnummer" : "Verification number"}:{" "}
              <span style={{ fontFamily: "monospace", fontWeight: "bold", color: DARK }}>
                {cert.verificationCode}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Logos footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "40px",
          marginTop: "20px",
          padding: "8px 0",
        }}
      >
        <img
          src={faLogo}
          alt="Fascia Academy"
          style={{ height: "48px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
        />
        <img
          src={atlasLogo}
          alt="Atlasbalans"
          style={{ height: "48px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
        />
      </div>
    </div>
  );
}

export default function CertificatePublic() {
  const params = useParams<{ uuid: string }>();
  const uuid = params.uuid ?? "";

  const { data, isLoading, error } = trpc.certificates.getByUuid.useQuery(
    { uuid },
    { enabled: !!uuid, retry: false }
  );

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Fascia Academy Certificate", url });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Certificate Not Found</h1>
          <p className="text-gray-500">This certificate link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap');
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          #certificate-content { box-shadow: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100 py-8 px-4">
        {/* Action buttons */}
        <div className="no-print flex justify-center gap-3 mb-6">
          <Button
            onClick={handlePrint}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Download / Print
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>

        {/* Certificate */}
        <CertificateRender cert={data.cert} template={data.template} />

        {/* Footer */}
        <div className="no-print text-center mt-6 text-sm text-gray-400 space-y-1">
          {data.cert.verificationCode && (
            <p className="font-mono text-xs text-gray-500">
              Verifikation: <span className="font-bold text-gray-700">{data.cert.verificationCode}</span>
            </p>
          )}
          <p>
            Utfärdat av{" "}
            <a
              href="https://www.fasciaacademy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 hover:underline"
            >
              Fascia Academy
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
