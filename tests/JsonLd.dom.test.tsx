import { render } from '@testing-library/react';
import { JsonLd } from '@withwiz/pms/components/JsonLd';

const U2028 = String.fromCharCode(0x2028);
const U2029 = String.fromCharCode(0x2029);

describe('JsonLd 컴포넌트', () => {
  it('PMS-JL-01: <script type="application/ld+json"> 태그 렌더링', () => {
    const { container } = render(<JsonLd data={{ '@type': 'Organization' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
  });

  it('PMS-JL-02: breakout-safe escaping + JSON.parse round-trip (revised §4.6)', () => {
    // Single fixture carrying ALL breakout payload kinds simultaneously:
    // a </script> substring, a <!-- substring, literal < / > / &, and the
    // raw U+2028 and U+2029 code points.
    const data = {
      '@type': 'Organization',
      name: 'Dance Theater Shahar',
      evil: '</script><!-- < > & end',
      ls: `line${U2028}sep`,
      ps: `para${U2029}sep`,
    };

    const { container } = render(<JsonLd data={data} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    const text = script!.innerHTML;

    // (a) No literal </script breakout substring (case-insensitive), no
    //     <!-- / < / >, and no raw U+2028 / U+2029 survive in the script text.
    expect(text.toLowerCase()).not.toContain('</script');
    expect(text).not.toContain('<!--');
    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
    expect(text).not.toContain(U2028);
    expect(text).not.toContain(U2029);

    // (b) JSON.parse of the decoded script content deep-equals original data
    //     (round-trip exact — the \uXXXX escapes are valid JSON).
    expect(JSON.parse(text)).toEqual(data);
  });

  it('PMS-JL-03: 중첩 객체 처리', () => {
    const data = {
      '@type': 'Event',
      location: {
        '@type': 'Place',
        name: '예술의전당',
        address: { '@type': 'PostalAddress', addressLocality: '서울' },
      },
    };
    const { container } = render(<JsonLd data={data} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const parsed = JSON.parse(script!.innerHTML);
    expect(parsed.location.address.addressLocality).toBe('서울');
  });

  it('PMS-JL-04: 특수 문자 포함 값 처리', () => {
    const data = {
      name: 'Ballet "Swan Lake" <2024>',
      description: "공연 & 전시 '특별'",
    };
    const { container } = render(<JsonLd data={data} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const parsed = JSON.parse(script!.innerHTML);
    expect(parsed.name).toBe('Ballet "Swan Lake" <2024>');
    expect(parsed.description).toBe("공연 & 전시 '특별'");
  });
});
