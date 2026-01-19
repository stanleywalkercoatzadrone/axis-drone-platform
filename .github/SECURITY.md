# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Axis by CoatzadroneUSA seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Where to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:
- **Email**: security@coatzadroneusa.com
- **Subject**: [SECURITY] Brief description of the issue

### What to Include

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours of receiving your report
- **Status Update**: Within 7 days with our evaluation and expected resolution timeline
- **Resolution**: We aim to release a fix within 30 days for critical vulnerabilities

### Disclosure Policy

- We request that you give us reasonable time to investigate and mitigate the issue before any public disclosure
- We will keep you informed of our progress
- Once the issue is resolved, we will publicly acknowledge your responsible disclosure (unless you prefer to remain anonymous)

## Security Best Practices

When deploying this application:

1. **Environment Variables**: Never commit `.env` files or expose sensitive credentials
2. **Database**: Use strong passwords and restrict database access to necessary IPs only
3. **JWT Secrets**: Generate strong, random JWT secrets (minimum 32 characters)
4. **HTTPS**: Always use HTTPS in production environments
5. **Updates**: Keep all dependencies up to date using Dependabot
6. **Access Control**: Implement proper RBAC and regularly audit user permissions
7. **Rate Limiting**: Enable rate limiting on all API endpoints in production
8. **Input Validation**: All user inputs are validated and sanitized
9. **File Uploads**: Restrict file types and scan uploaded files for malware
10. **Monitoring**: Enable audit logging and monitor for suspicious activities

## Security Features

This application includes:

- ✅ JWT-based authentication with refresh tokens
- ✅ Password hashing with bcrypt (12 rounds)
- ✅ CORS protection
- ✅ Helmet.js security headers
- ✅ SQL injection prevention via parameterized queries
- ✅ XSS protection
- ✅ CSRF protection
- ✅ Role-based access control (RBAC)
- ✅ Comprehensive audit logging
- ✅ Secure file upload handling

## Automated Security

We use the following automated security tools:

- **Dependabot**: Automated dependency updates
- **CodeQL**: Static code analysis for vulnerabilities
- **npm audit**: Regular dependency vulnerability scanning
- **GitHub Security Advisories**: Automated alerts for known vulnerabilities

## Contact

For general security questions or concerns:
- Email: support@coatzadroneusa.com
- Website: https://coatzadroneusa.com

---

**Thank you for helping keep Axis by CoatzadroneUSA and our users safe!**
