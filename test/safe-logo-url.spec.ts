import { isPrivateIPv4, isPrivateIPv6, isSafeLogoUrl } from '../src/modules/quotes/safe-logo-url';

/**
 * Testes unitários do validador anti-SSRF de logoUrl.
 * Nenhuma rede é acessada — IPs literais são avaliados localmente.
 */
describe('safe-logo-url (anti-SSRF)', () => {
  describe('isPrivateIPv4', () => {
    it.each([
      ['10.0.0.1', true],
      ['172.16.0.1', true],
      ['172.31.255.255', true],
      ['192.168.1.1', true],
      ['127.0.0.1', true],
      ['169.254.169.254', true], // metadata cloud
      ['0.0.0.0', true],
      ['224.0.0.1', true], // multicast
      ['8.8.8.8', false],
      ['172.32.0.1', false], // fora do bloco 172.16/12
      ['192.169.1.1', false],
      ['200.100.50.25', false],
    ])('%s → %s', (ip, expected) => {
      expect(isPrivateIPv4(ip)).toBe(expected);
    });
  });

  describe('isPrivateIPv6', () => {
    it.each([
      ['::1', true],
      ['::', true],
      ['fc00::1', true],
      ['fd12:3456::1', true],
      ['fe80::1', true],
      ['ff02::1', true], // multicast
      ['::ffff:127.0.0.1', true], // IPv4-mapped → loopback
      ['::ffff:169.254.169.254', true], // IPv4-mapped → metadata cloud
      ['::ffff:10.0.0.1', true], // IPv4-mapped → privado
      ['::ffff:8.8.8.8', false], // IPv4-mapped → público
      ['2001:4860:4860::8888', false], // Google DNS público
      ['2606:4700::1111', false], // Cloudflare público
    ])('%s → %s', (ip, expected) => {
      expect(isPrivateIPv6(ip)).toBe(expected);
    });
  });

  describe('isSafeLogoUrl', () => {
    it('aceita URL pública http', async () => {
      await expect(isSafeLogoUrl('http://example.com/logo.png')).resolves.toBe(true);
    });

    it('aceita URL pública https', async () => {
      await expect(isSafeLogoUrl('https://example.com/logo.png')).resolves.toBe(true);
    });

    it('rejeita IP privado literal (metadata cloud)', async () => {
      await expect(isSafeLogoUrl('http://169.254.169.254/latest/meta-data')).resolves.toBe(false);
    });

    it('rejeita loopback literal', async () => {
      await expect(isSafeLogoUrl('http://127.0.0.1:3000/logo.png')).resolves.toBe(false);
    });

    it('rejeita IP privado literal (192.168)', async () => {
      await expect(isSafeLogoUrl('http://192.168.0.10/logo.png')).resolves.toBe(false);
    });

    it('rejeita IPv6 loopback', async () => {
      await expect(isSafeLogoUrl('http://[::1]:8080/logo.png')).resolves.toBe(false);
    });

    it('rejeita IPv4-mapped IPv6 (loopback)', async () => {
      await expect(
        isSafeLogoUrl('http://[::ffff:127.0.0.1]:8080/logo.png'),
      ).resolves.toBe(false);
    });

    it('rejeita IPv4-mapped IPv6 (metadata cloud)', async () => {
      await expect(
        isSafeLogoUrl('http://[::ffff:169.254.169.254]/latest/meta-data'),
      ).resolves.toBe(false);
    });

    it('rejeita scheme não-http (file://)', async () => {
      await expect(isSafeLogoUrl('file:///etc/passwd')).resolves.toBe(false);
    });

    it('rejeita scheme não-http (ftp://)', async () => {
      await expect(isSafeLogoUrl('ftp://example.com/logo.png')).resolves.toBe(false);
    });

    it('rejeita URL inválida', async () => {
      await expect(isSafeLogoUrl('not a url')).resolves.toBe(false);
    });

    it('rejeita hostname que resolve para IP privado (localhost)', async () => {
      await expect(isSafeLogoUrl('http://localhost/logo.png')).resolves.toBe(false);
    });
  });
});