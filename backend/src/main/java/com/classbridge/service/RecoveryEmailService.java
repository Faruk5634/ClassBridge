package com.classbridge.service;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class RecoveryEmailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String smtpHost;
    private final String fromAddress;

    public RecoveryEmailService(ObjectProvider<JavaMailSender> mailSenderProvider,
                                @Value("${spring.mail.host:}") String smtpHost,
                                @Value("${classbridge.mail.from:}") String fromAddress) {
        this.mailSenderProvider = mailSenderProvider;
        this.smtpHost = smtpHost;
        this.fromAddress = fromAddress;
    }

    public boolean isConfigured() {
        return StringUtils.hasText(smtpHost)
                && StringUtils.hasText(fromAddress)
                && mailSenderProvider.getIfAvailable() != null;
    }

    public boolean sendVerificationCode(String email, String code) {
        return send(email, "ClassBridge e-posta adresini doğrula", "E-posta adresini doğrula", code,
                "Bu kod, ClassBridge hesabındaki e-posta adresinin sana ait olduğunu doğrulamak için kullanılır.");
    }

    public boolean sendPasswordResetCode(String email, String code) {
        return send(email, "ClassBridge parola sıfırlama kodun", "Parolanı sıfırla", code,
                "ClassBridge hesabın için parola sıfırlama talebi aldık.");
    }

    private boolean send(String email, String subject, String heading, String code, String description) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null || !StringUtils.hasText(smtpHost) || !StringUtils.hasText(fromAddress)) {
            return false;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress, "ClassBridge");
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setText(plainTextBody(heading, code, description), htmlBody(heading, code, description));
            mailSender.send(message);
            return true;
        } catch (MessagingException | java.io.UnsupportedEncodingException | RuntimeException exception) {
            return false;
        }
    }

    private String plainTextBody(String heading, String code, String description) {
        return "ClassBridge\n\n" + heading + "\n\n" + description + "\n\n" +
                "Doğrulama kodun: " + code + "\n\n" +
                "Bu kod 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir.\n" +
                "Bu işlemi sen başlatmadıysan bu e-postayı yok sayabilirsin.\n\n" +
                "Bu otomatik bir bilgilendirmedir; lütfen yanıtlamayın.";
    }

    private String htmlBody(String heading, String code, String description) {
        return """
                <!doctype html>
                <html lang="tr">
                <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
                  <div style="max-width:560px;margin:32px auto;padding:0 16px;">
                    <div style="background:#1d4ed8;border-radius:16px 16px 0 0;padding:22px 28px;color:#ffffff;">
                      <div style="font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">ClassBridge</div>
                      <div style="font-size:24px;font-weight:700;margin-top:8px;">%s</div>
                    </div>
                    <div style="background:#ffffff;padding:28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px;">
                      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">%s</p>
                      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:18px;text-align:center;">
                        <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:1px;">Doğrulama kodun</div>
                        <div style="font-size:34px;font-weight:700;letter-spacing:9px;color:#1d4ed8;margin:10px 0 2px;">%s</div>
                      </div>
                      <p style="font-size:14px;line-height:1.6;color:#475569;margin:20px 0 0;">Kod 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir.</p>
                      <p style="font-size:13px;line-height:1.6;color:#64748b;margin:14px 0 0;">Bu işlemi sen başlatmadıysan bu e-postayı yok sayabilirsin.</p>
                    </div>
                    <div style="font-size:12px;color:#94a3b8;text-align:center;padding:18px;">Bu otomatik bir bilgilendirmedir; lütfen yanıtlamayın.</div>
                  </div>
                </body>
                </html>
                """.formatted(escapeHtml(heading), escapeHtml(description), escapeHtml(code));
    }

    private String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
