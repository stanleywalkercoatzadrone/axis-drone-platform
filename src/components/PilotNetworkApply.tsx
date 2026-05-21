import React, { useState, useEffect } from 'react';
import {
    Plane, Mail, User, Phone, Globe, MapPin, ArrowRight,
    Loader2, CheckCircle2, ChevronDown, Briefcase, Award,
    FileText, ExternalLink, Shield, Zap, Users, Layout
} from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';

// ── Pilot-specific page metadata (title, description, favicon) ─────────────
function usePilotPageMeta() {
    useEffect(() => {
        // Save originals
        const prevTitle = document.title;
        const prevDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const prevFavicon = (document.querySelector('link[rel="icon"]') as HTMLLinkElement)?.href || '';

        // Set pilot-specific values
        document.title = 'Join the Axis Pilot Network | Apply Now';

        const descEl = document.querySelector('meta[name="description"]') as HTMLMetaElement;
        if (descEl) descEl.content = 'Pilot Enrollment — Apply to join the Axis Pilot Network and get matched with enterprise drone inspection missions near you.';

        // Drone emoji SVG as favicon
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">🛸</text></svg>`;
        const faviconUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
        let faviconEl = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (!faviconEl) {
            faviconEl = document.createElement('link');
            faviconEl.rel = 'icon';
            document.head.appendChild(faviconEl);
        }
        faviconEl.href = faviconUrl;

        // Restore on unmount
        return () => {
            document.title = prevTitle;
            if (descEl) descEl.content = prevDesc;
            if (faviconEl) faviconEl.href = prevFavicon;
        };
    }, []);
}

const COUNTRIES = [
    ['US','🇺🇸 United States'],['MX','🇲🇽 Mexico'],['CA','🇨🇦 Canada'],['BR','🇧🇷 Brazil'],
    ['GB','🇬🇧 United Kingdom'],['AU','🇦🇺 Australia'],['FR','🇫🇷 France'],['DE','🇩🇪 Germany'],
    ['ES','🇪🇸 Spain'],['JP','🇯🇵 Japan'],['KR','🇰🇷 South Korea'],['IN','🇮🇳 India'],
    ['AE','🇦🇪 UAE'],['SG','🇸🇬 Singapore'],['ZA','🇿🇦 South Africa'],['NG','🇳🇬 Nigeria'],
    ['CL','🇨🇱 Chile'],['CO','🇨🇴 Colombia'],['AR','🇦🇷 Argentina'],['NL','🇳🇱 Netherlands'],
];

const GLOBAL_CERTS = ['BVLOS Waiver','Night Ops Waiver','Remote ID Compliant','ISO 9001','Other'];

const COUNTRY_CERTS: Record<string, string[]> = {
    'US': ['FAA Part 107 Remote Pilot Certificate'],
    'CA': ['Transport Canada Pilot Certificate – Basic Operations', 'Transport Canada Pilot Certificate – Advanced Operations', 'Transport Canada Pilot Certificate – Level 1 Complex Operations'],
    'GB': ['CAA Flyer ID / Operator ID', 'GVC', 'A2 CofC'],
    'AU': ['CASA RePL', 'CASA ReOC'],
    'FR': ['EASA A1/A3', 'EASA A2', 'EASA Specific'],
    'DE': ['EASA A1/A3', 'EASA A2', 'EASA Specific'],
    'ES': ['EASA A1/A3', 'EASA A2', 'EASA Specific'],
    'NL': ['EASA A1/A3', 'EASA A2', 'EASA Specific'],
    'MX': ['Licencia de Piloto de RPAS (AFAC)'],
    'BR': ['Licença de Piloto Remoto de RPA (ANAC)', 'Autorização Específica de Voo (ANAC)'],
    'JP': ['DIPS Registration / MLIT Permission'],
    'KR': ['KOTSA Drone Certificate'],
    'IN': ['DGCA Remote Pilot Certificate'],
    'AE': ['GCAA Drone Registration'],
    'SG': ['CAAS UAPL'],
    'ZA': ['SACAA RPL'],
    'NG': ['NCAA RPA Certificate'],
    'CL': ['Credencial de Piloto a Distancia de RPAS (DGAC)'],
    'CO': ['Certificado de Idoneidad como Piloto de UAS (Aerocivil)'],
    'AR': ['Certificado de Competencia de Piloto a Distancia (ANAC)']
};
const SPECIALIZATIONS = ['Solar Inspection','Infrastructure','Agriculture','Construction','Insurance','Search & Rescue','Mapping & Surveying','Oil & Gas','Utilities','Forestry','Real Estate'];
const EQUIPMENT = ['DJI Mavic 3T (Thermal)','DJI Matrice 300 RTK','DJI Phantom 4 RTK','Autel Evo Max','Skydio 2+','senseFly eBee','Custom Fixed Wing','Other'];

const PilotNetworkApply: React.FC = () => {
    usePilotPageMeta();

    const [submitted, setSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        fullName: '',
        email: '',
        phone: '',
        country: 'US',
        city: '',
        yearsExp: '0',
        bio: '',
        portfolioUrl: '',
        certifications: [] as string[],
        specializations: [] as string[],
        droneEquipment: [] as string[],
        terrestrialThermal: false,
        travelDistanceKm: 50,
    });

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (k === 'country') {
            setForm(f => ({ ...f, country: e.target.value, certifications: [] }));
        } else {
            setForm(f => ({ ...f, [k]: e.target.value }));
        }
    };

    const toggleArray = (key: 'certifications' | 'specializations' | 'droneEquipment', val: string) => {
        setForm(f => ({
            ...f,
            [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!form.fullName || !form.email || !form.country) {
            setError('Name, email and country are required.');
            return;
        }
        setIsLoading(true);
        try {
            await axios.post('/api/pilot-network/apply', {
                fullName: form.fullName,
                email: form.email,
                phone: form.phone,
                country: form.country,
                city: form.city,
                yearsExp: parseInt(form.yearsExp) || 0,
                certifications: form.certifications,
                specializations: form.specializations,
                droneEquipment: form.droneEquipment,
                bio: form.bio,
                portfolioUrl: form.portfolioUrl,
                terrestrialThermal: form.terrestrialThermal,
                travelDistanceKm: form.travelDistanceKm,
            });
            setSubmitted(true);
        } catch (err: any) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Submission failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
                <div className="max-w-md text-center">
                    <div className="w-20 h-20 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-blue-400" />
                    </div>
                    <h1 className="text-2xl font-black text-white mb-3">Application Received</h1>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                        Thanks for applying to the Axis Pilot Network. Our team will review your profile and reach out within <span className="text-white font-semibold">3–5 business days</span>.
                    </p>
                    <div className="space-y-3">
                        <a href="https://axisplatform.app" className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all">
                            <ExternalLink className="w-4 h-4" /> Return to Axis Platform
                        </a>
                        <Link to="/login" className="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-all">
                            Sign in if you already have an account
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 font-sans">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 bg-slate-950/90 backdrop-blur border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <Layout className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <span className="font-black text-white text-sm uppercase tracking-tight">Axis</span>
                        <span className="text-[9px] text-blue-400 font-black uppercase tracking-[0.3em] block leading-none">Pilot Network</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/login" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">Sign in</Link>
                    <a href="https://axisplatform.app" className="text-xs px-4 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors font-semibold">Platform</a>
                </div>
            </nav>

            {/* Hero */}
            <div className="pt-16">
                <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-20 text-center">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full" />
                    </div>
                    <div className="relative z-10 max-w-2xl mx-auto">
                        <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
                            <Plane className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Now Recruiting</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4">
                            Join the Axis<br /><span className="text-blue-400">Pilot Network</span>
                        </h1>
                        <p className="text-slate-400 text-base leading-relaxed max-w-xl mx-auto">
                            Work on enterprise drone inspection missions across solar, infrastructure, agriculture and more. 
                            Apply below and our team will match you with opportunities in your region.
                        </p>
                    </div>
                </div>

                {/* Why join */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto px-6 py-10">
                    {[
                        { icon: Shield, title: 'Vetted Missions', desc: 'Work only with enterprise clients on professionally managed, insured operations.', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                        { icon: Zap, title: 'AI-Powered Platform', desc: 'Access mission briefs, flight parameters, weather data and AI analysis tools in one place.', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
                        { icon: Users, title: 'Global Community', desc: 'Join pilots in 40+ countries flying inspections for energy, construction and insurance clients.', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
                    ].map(f => (
                        <div key={f.title} className={`p-5 rounded-2xl border ${f.bg} ${f.border}`}>
                            <f.icon className={`w-6 h-6 ${f.color} mb-3`} />
                            <h3 className="text-sm font-bold text-white mb-1">{f.title}</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Application Form */}
            <div className="max-w-3xl mx-auto px-6 pb-24">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/80">
                        <h2 className="text-base font-black text-white uppercase tracking-wider">Pilot Application</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Takes about 3 minutes — all fields marked * are required.</p>
                    </div>

                    {error && (
                        <div className="mx-6 mt-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
                    )}

                    <form onSubmit={handleSubmit} className="p-6 space-y-8">

                        {/* Section 1: Personal Info */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-6 h-6 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                                    <User className="w-3.5 h-3.5 text-blue-400" />
                                </div>
                                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Personal Information</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Full Name *">
                                    <input type="text" value={form.fullName} onChange={set('fullName')} placeholder="Jane Smith" required className={inputCls} />
                                </Field>
                                <Field label="Email Address *">
                                    <input type="email" value={form.email} onChange={set('email')} placeholder="jane@email.com" required className={inputCls} />
                                </Field>
                                <Field label="Phone Number">
                                    <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" className={inputCls} />
                                </Field>
                                <Field label="City / Region">
                                    <input type="text" value={form.city} onChange={set('city')} placeholder="Austin, TX" className={inputCls} />
                                </Field>
                                <Field label="Country *">
                                    <div className="relative">
                                        <select value={form.country} onChange={set('country')} className={inputCls}>
                                            {COUNTRIES.map(([iso, label]) => (
                                                <option key={iso} value={iso}>{label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    </div>
                                </Field>
                                <Field label="Years of Experience">
                                    <div className="relative">
                                        <select value={form.yearsExp} onChange={set('yearsExp')} className={inputCls}>
                                            {['0','1','2','3','4','5','6-10','10+'].map(v => (
                                                <option key={v} value={v}>{v === '0' ? 'Less than 1 year' : `${v} year${v === '1' ? '' : 's'}`}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    </div>
                                </Field>
                            </div>
                        </div>

                        {/* Section 2: Certifications */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-6 h-6 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                                    <Award className="w-3.5 h-3.5 text-emerald-400" />
                                </div>
                                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Certifications</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {([...(COUNTRY_CERTS[form.country] || ['National Aviation Authority License']), ...GLOBAL_CERTS]).map(c => (
                                    <button
                                        key={c} type="button"
                                        onClick={() => toggleArray('certifications', c)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                            form.certifications.includes(c)
                                                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                        }`}
                                    >
                                        {form.certifications.includes(c) ? '✓ ' : ''}{c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section 3: Specializations */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-6 h-6 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                                    <Briefcase className="w-3.5 h-3.5 text-violet-400" />
                                </div>
                                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Specializations</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {SPECIALIZATIONS.map(s => (
                                    <button
                                        key={s} type="button"
                                        onClick={() => toggleArray('specializations', s)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                            form.specializations.includes(s)
                                                ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                        }`}
                                    >
                                        {form.specializations.includes(s) ? '✓ ' : ''}{s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section 4: Equipment & Bio */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-6 h-6 rounded-lg bg-amber-600/20 border border-amber-500/30 flex items-center justify-center">
                                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                                </div>
                                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Equipment & Profile</h3>
                            </div>
                            <div className="space-y-4">

                                {/* Terrestrial Thermal Toggle — moved above equipment */}
                                <div
                                    onClick={() => setForm(f => ({ ...f, terrestrialThermal: !f.terrestrialThermal }))}
                                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all select-none ${
                                        form.terrestrialThermal
                                            ? 'bg-orange-500/10 border-orange-500/30'
                                            : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                                    }`}
                                >
                                    <div>
                                        <p className={`text-sm font-bold ${form.terrestrialThermal ? 'text-orange-300' : 'text-slate-200'}`}>
                                            Are you willing to perform terrestrial thermal scans?
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Ground-level thermal inspections of panels, equipment and substation assets
                                        </p>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full flex items-center transition-all shrink-0 ml-4 ${
                                        form.terrestrialThermal ? 'bg-orange-500 justify-end' : 'bg-slate-700 justify-start'
                                    }`}>
                                        <div className="w-4 h-4 bg-white rounded-full mx-1 shadow" />
                                    </div>
                                </div>

                                {/* Multi-select Drone Equipment */}
                                <Field label="Drone Equipment (select all that apply)">
                                    <div className="flex flex-wrap gap-2">
                                        {EQUIPMENT.map(e => (
                                            <button
                                                key={e} type="button"
                                                onClick={() => toggleArray('droneEquipment', e)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                                    form.droneEquipment.includes(e)
                                                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                                }`}
                                            >
                                                {form.droneEquipment.includes(e) ? '✓ ' : ''}{e}
                                            </button>
                                        ))}
                                    </div>
                                </Field>

                                {/* Travel Distance Slider */}
                                <Field label={`Willing to travel up to: ${form.travelDistanceKm === 500 ? '500+ km' : `${form.travelDistanceKm} km`}`}>
                                    <div className="space-y-2">
                                        <input
                                            type="range"
                                            min={0}
                                            max={500}
                                            step={25}
                                            value={form.travelDistanceKm}
                                            onChange={e => setForm(f => ({ ...f, travelDistanceKm: parseInt(e.target.value) }))}
                                            className="w-full accent-blue-500"
                                        />
                                        <div className="flex justify-between text-[10px] text-slate-500">
                                            <span>Local only</span>
                                            <span>100 km</span>
                                            <span>250 km</span>
                                            <span>500+ km</span>
                                        </div>
                                    </div>
                                </Field>
                                <Field label="Portfolio / LinkedIn / Website">
                                    <input type="url" value={form.portfolioUrl} onChange={set('portfolioUrl')} placeholder="https://..." className={inputCls} />
                                </Field>
                                <Field label="About You">
                                    <textarea
                                        value={form.bio}
                                        onChange={set('bio')}
                                        rows={4}
                                        placeholder="Tell us about your experience, the types of missions you've flown, and why you want to join the Axis Pilot Network..."
                                        className={`${inputCls} resize-none`}
                                    />
                                </Field>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 uppercase tracking-wider"
                        >
                            {isLoading
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                                : <><CheckCircle2 className="w-4 h-4" /> Submit Application <ArrowRight className="w-4 h-4" /></>
                            }
                        </button>

                        <p className="text-center text-[10px] text-slate-600 leading-relaxed">
                            By submitting this form you agree to our{' '}
                            <a href="https://axisplatform.app/terms" className="underline hover:text-slate-400">Terms</a> and{' '}
                            <a href="https://axisplatform.app/privacy" className="underline hover:text-slate-400">Privacy Policy</a>.
                            Your information will only be used to evaluate your application.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

const inputCls = "w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 appearance-none";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
        {children}
    </div>
);

export default PilotNetworkApply;
