import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { useAuth } from './auth';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2,
  Clock3, Download, LockKeyhole,
  MapPin, Menu, QrCode, Search, ShieldCheck, Ticket, Users, X,
} from 'lucide-react';
import schoolLogo from '@assets/0_Logo_maker_project_-_08_November_2026_at_15.30.59_1794159672038.png';
import {
  getGetEventQueryKey, getGetRegistrationBadgeQueryKey, getListAdminArchiveQueryKey,
  getExportEventRegistrationsQueryKey, getListAdminEventsQueryKey,
  getListEventRegistrationsQueryKey, getListEventsQueryKey,
  getListPublicArchiveQueryKey, getGetAdminSettingsQueryKey,
  useCancelOwnRegistration, useCreateEvent, useExportEventRegistrations, useGetAdminSettings,
  useGetEvent, useGetRegistrationBadge, useGetUpcomingEvent, useHealthCheck,
  useListActivities, useListAdminArchive, useListAdminEvents, useListEventRegistrations,
  useListEvents, useListPublicArchive, useRegisterForEvent, useUpdateAdminSettings,
  useUpdateEvent, useUpdateRegistrationStatus,
} from '@workspace/api-client-react';
import type { Activity, AdminEvent, Event, RegistrationBadge, RegistrationRow } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { encodeBadgeQr } from './qr';
import './index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
const whatsappCommunityUrl = import.meta.env.VITE_WHATSAPP_COMMUNITY_URL;
const fmtDate = (date?: string) => date ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`)) : '';
const shortDate = (date?: string) => date ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`)) : '';
const errorText = (error: unknown) => {
  const maybe = error as { message?: string; response?: { data?: { error?: string } } };
  const msg = maybe?.response?.data?.error || maybe?.message || 'Une erreur est survenue. Réessayez.';
  if (/full|capacity|complet/i.test(msg)) return 'Cet événement est complet. Les inscriptions ne sont plus possibles.';
  if (/closed|open|fermé/i.test(msg)) return 'Les inscriptions pour cet événement sont fermées.';
  if (/duplicate|already|existe|inscrit/i.test(msg)) return 'Une inscription existe déjà pour ces informations.';
  if (/401|unauthorized|403|forbidden/i.test(msg)) return 'Accès réservé aux administrateurs autorisés.';
  if (/404|not found/i.test(msg)) return 'Aucun résultat ne correspond à ce numéro.';
  return msg;
};

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="inline-flex items-center gap-3 no-underline" data-testid="link-home-brand">
    <img src={schoolLogo} alt="Logo du Lycée Mustapha El Maani" className="h-11 w-11 shrink-0 object-contain" data-testid="img-school-logo" />
    {!compact && <span className="leading-tight"><b className="block text-[15px] tracking-[-.04em] text-[#10202b]">Maani Connect</b><span className="text-[10px] font-medium uppercase tracking-[.13em] text-[#637168]">Lycée Mustapha El Maani</span></span>}
  </Link>;
}

function Header() {
  const [open, setOpen] = useState(false);
  const nav = [['Programme', '/programme'], ['Archives', '/archive'], ['Mon badge', '/mon-badge']];
  return <header className="relative z-20 border-b border-[#d9d0c1] bg-[#f3eee4]/95">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-9">
      <Brand />
      <nav className="hidden items-center gap-8 md:flex">
        {nav.map(([label, href]) => <Link key={href} href={href} className="maani-link text-[13px] font-semibold text-[#42524a] no-underline" data-testid={`link-nav-${href.slice(1)}`}>{label}</Link>)}
        <Link href="/admin" className="rounded-full border border-[#c9c2b6] px-4 py-2 text-[12px] font-semibold text-[#10202b] no-underline transition hover:border-[#1fa855]" data-testid="link-admin">Espace admin</Link>
      </nav>
      <button aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} data-testid="button-menu" onClick={() => setOpen(!open)} className="grid size-10 place-items-center rounded-xl border border-[#d5ccbc] bg-[#f8f4ec] text-[#10202b] md:hidden">{open ? <X size={19} /> : <Menu size={19} />}</button>
    </div>
    {open && <nav className="absolute left-0 right-0 top-full border-b border-[#d9d0c1] bg-[#f3eee4] px-5 py-3 shadow-lg md:hidden">
      {[...nav, ['Espace admin', '/admin']].map(([label, href]) => <Link onClick={() => setOpen(false)} key={href} href={href} className="block border-b border-[#ded6c9] py-3 text-sm font-semibold text-[#10202b] no-underline last:border-0" data-testid={`link-mobile-${href.slice(1)}`}>{label}<ArrowRight className="float-right" size={17} /></Link>)}
    </nav>}
  </header>;
}

function Footer() {
  return <footer className="relative z-10 mt-20 border-t border-[#d9d0c1] bg-[#eee8dc]">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-9">
      <Brand />
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#59675f]">
        <Link className="maani-link no-underline" href="/confidentialite" data-testid="link-privacy">Confidentialité</Link>
        <Link className="maani-link no-underline" href="/mon-badge" data-testid="link-find-badge">Retrouver un badge</Link>
        <span>© Lycée Mustapha El Maani</span>
      </div>
    </div>
  </footer>;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="maani-shell"><div className="maani-content"><Header />{children}<Footer /></div></div>;
}

function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text?: string }) {
  return <div className="mb-9 max-w-3xl"><p className="maani-mono mb-4 text-[10px] font-medium uppercase text-[#1fa855]">{eyebrow}</p><h1 className="maani-display text-4xl font-bold md:text-6xl">{title}</h1>{text && <p className="mt-5 max-w-2xl text-sm leading-7 text-[#5d6962] md:text-base">{text}</p>}</div>;
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="rounded-2xl border border-[#e4bcb3] bg-[#fbefeb] p-5 text-sm text-[#7a3026]" data-testid="status-error"><p className="font-semibold">{message}</p>{onRetry && <button onClick={onRetry} className="mt-3 font-bold underline underline-offset-4" data-testid="button-retry">Réessayer</button>}</div>;
}

function LoadingRows() {
  return <div className="space-y-3" aria-label="Chargement"><div className="h-24 animate-pulse rounded-2xl bg-[#e6dfd3]" /><div className="h-24 animate-pulse rounded-2xl bg-[#e6dfd3]" /></div>;
}

function EventTile({ event, index = 0 }: { event: Event; index?: number }) {
  return <article className={`maani-enter overflow-hidden rounded-[24px] border border-[#d9d0c1] bg-[#f9f5ec] ${index % 3 === 1 ? 'md:translate-y-7' : ''}`} style={{ animationDelay: `${index * 90}ms` }} data-testid={`card-event-${event.id}`}>
    <div className="flex min-h-[125px] items-start justify-between border-b border-[#ddd5c8] bg-[#e8f1e8] p-5">
      <div><span className="maani-mono text-[10px] uppercase text-[#43805a]">Rendez-vous au lycée</span><h3 className="mt-3 max-w-sm text-xl font-bold leading-tight tracking-[-.04em] text-[#10202b]">{event.title}</h3></div>
      <div className="ml-3 grid size-[58px] shrink-0 content-center rounded-2xl bg-[#1fa855] text-center text-white"><b className="text-xl leading-5">{shortDate(event.date).split(' ')[0]}</b><span className="text-[9px] uppercase">{shortDate(event.date).split(' ')[1]}</span></div>
    </div>
    <div className="space-y-3 p-5">
      <p className="line-clamp-2 min-h-10 text-xs leading-5 text-[#5d6962]">{event.description}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-[#526058]"><span className="inline-flex items-center gap-1.5"><Clock3 size={14} />{event.time}</span><span className="inline-flex items-center gap-1.5"><MapPin size={14} />{event.place}</span></div>
      <div className="flex items-center justify-between border-t border-[#e6dfd3] pt-4">
        <span className={`text-[11px] font-semibold ${event.spotsLeft > 0 && event.isOpen ? 'text-[#258347]' : 'text-[#a34d3e]'}`}>{event.spotsLeft <= 0 ? 'Complet' : event.isOpen ? `${event.spotsLeft} places disponibles` : 'Inscriptions fermées'}</span>
        <Link href={`/evenements/${event.id}`} className="inline-flex items-center gap-1 rounded-full bg-[#10202b] px-4 py-2.5 text-[11px] font-semibold text-[#f3eee4] no-underline hover:bg-[#1fa855]" data-testid={`link-event-${event.id}`}>Découvrir <ArrowRight size={14} /></Link>
      </div>
    </div>
  </article>;
}

function HomePage() {
  const upcoming = useGetUpcomingEvent();
  const events = useListEvents();
  const health = useHealthCheck();
  const event = upcoming.data?.event;
  return <Shell><main className="mx-auto max-w-7xl px-5 md:px-9">
    <section className="relative grid min-h-[590px] items-center gap-10 py-14 md:grid-cols-[1.08fr_.92fr] md:py-20">
      <div className="maani-enter relative z-10">
        <p className="maani-mono mb-6 inline-flex items-center gap-2 text-[10px] uppercase text-[#1fa855]"><span className="size-2 rounded-full bg-[#1fa855]" />La vie du lycée, en mouvement</p>
        <h1 className="maani-display max-w-[780px] text-[clamp(3.7rem,9.5vw,7.3rem)] font-bold">Maani <span className="text-[#1fa855]">Connect</span></h1>
        <p className="mt-7 max-w-lg text-sm leading-7 text-[#59675f] md:text-base">Les activités, les rencontres et les idées qui font vivre le Lycée Mustapha El Maani. À toi de rejoindre le prochain rendez-vous.</p>
        <div className="mt-8 flex flex-wrap gap-3"><a href={whatsappCommunityUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 rounded-full bg-[#1fa855] px-6 py-4 text-sm font-semibold text-white no-underline shadow-[4px_4px_0_#10202b] transition hover:translate-y-[-2px]" data-testid="link-whatsapp-community">Rejoindre la communauté WhatsApp <ArrowRight size={17} /></a><Link href="/programme" className="inline-flex items-center gap-3 rounded-full border border-[#cfc6b7] bg-[#f8f4ec] px-5 py-4 text-sm font-semibold text-[#10202b] no-underline" data-testid="link-discover-programme">Découvrir le programme <ArrowRight size={17} /></Link><Link href="/mon-badge" className="inline-flex items-center gap-2 rounded-full border border-[#cfc6b7] bg-[#f8f4ec] px-5 py-4 text-sm font-semibold text-[#10202b] no-underline" data-testid="link-find-my-badge"><Ticket size={16} /> Mon badge</Link></div>
        <p className="mt-9 text-[10px] font-medium uppercase tracking-[.11em] text-[#879087]">Simple à utiliser · Accessible sur mobile · Ouvert à tous les élèves</p>
      </div>
      <div className="relative mx-auto w-full max-w-[460px] md:justify-self-end">
        <div className="relative aspect-[.88] overflow-hidden rounded-[46%_46%_28px_28px] bg-[#dce9dc]">
          <div className="absolute left-[9%] top-[10%] size-[72%] rounded-full border border-[#b2cdb5]" />
          <div className="absolute left-[18%] top-[19%] size-[72%] rounded-full border border-[#b2cdb5]" />
          <div className="absolute inset-x-[13%] bottom-0 h-[61%] rounded-t-[48%] bg-[#1fa855]" />
          <div className="absolute left-[32%] top-[36%] h-[22%] w-[33%] rounded-[48%] bg-[#e8b997] rotate-[-8deg]" />
          <div className="absolute left-[29%] top-[30%] h-[15%] w-[39%] rounded-t-full bg-[#10202b] rotate-[-7deg]" />
          <div className="absolute right-[13%] top-[23%] grid size-16 rotate-12 place-items-center rounded-2xl bg-[#f0c467] text-[#10202b] shadow-[4px_4px_0_#10202b]"><CalendarDays size={27} /></div>
          <div className="absolute bottom-[14%] left-[11%] rounded-full border border-[#f3eee4]/60 bg-[#f3eee4]/90 px-4 py-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#10202b]">La communauté Maani</div>
        </div>
        <div className="absolute -bottom-5 -right-1 rotate-3 rounded-2xl bg-[#10202b] px-5 py-4 text-[#f3eee4] shadow-[5px_5px_0_#1fa855] md:-right-9"><span className="maani-mono text-[9px] uppercase text-[#92d6a8]">Lycée · ensemble</span><b className="mt-1 block text-lg">On fait ça ensemble.</b></div>
      </div>
    </section>
    <section className="relative my-12 overflow-hidden rounded-[28px] bg-[#10202b] p-6 text-[#f3eee4] md:my-20 md:p-10">
      <div className="absolute -right-16 -top-24 size-64 rounded-full border border-[#52635c]/70" /><div className="absolute -right-6 -top-14 size-44 rounded-full border border-[#52635c]/70" />
      <div className="relative grid gap-7 md:grid-cols-[.7fr_1.3fr] md:items-center">
        <div><p className="maani-mono text-[10px] uppercase text-[#8dd9a3]">À ne pas manquer</p><h2 className="mt-3 text-3xl font-bold tracking-[-.05em] md:text-4xl">Prochain rendez-vous</h2></div>
        {upcoming.isLoading ? <div className="h-28 animate-pulse rounded-2xl bg-white/10" /> : upcoming.isError ? <ErrorBox message={errorText(upcoming.error)} onRetry={() => upcoming.refetch()} /> : event ? <div className="flex flex-col gap-5 rounded-2xl border border-white/15 bg-white/[.06] p-5 md:flex-row md:items-center md:justify-between">
          <div><h3 className="text-xl font-bold">{event.title}</h3><p className="mt-2 text-xs text-[#c4d0c8]">{fmtDate(event.date)} · {event.time} · {event.place}</p><p className="mt-2 text-xs text-[#aebdb3]">{event.spotsLeft <= 0 ? 'Complet' : event.isOpen ? `${event.spotsLeft} places restantes` : 'Inscriptions fermées'}</p></div>
          <Link href={`/evenements/${event.id}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#1fa855] px-5 py-3 text-sm font-semibold text-white no-underline" data-testid="link-upcoming-event">Je m'inscris <ArrowRight size={16} /></Link>
        </div> : <div className="rounded-2xl border border-white/15 p-5"><p className="font-semibold">Aucun événement annoncé pour le moment.</p><p className="mt-1 text-xs text-[#b9c5be]">Reviens bientôt, le programme se prépare.</p></div>}
      </div>
    </section>
    <section className="py-7 md:py-12">
      <div className="mb-8 flex items-end justify-between"><div><p className="maani-mono text-[10px] uppercase text-[#1fa855]">À l'affiche</p><h2 className="mt-3 text-3xl font-bold tracking-[-.05em] md:text-4xl">Les prochains moments</h2></div><Link href="/programme" className="hidden items-center gap-2 text-xs font-semibold text-[#10202b] no-underline md:inline-flex" data-testid="link-all-events">Tout le programme <ArrowRight size={15} /></Link></div>
      {events.isLoading ? <LoadingRows /> : events.isError ? <ErrorBox message={errorText(events.error)} onRetry={() => events.refetch()} /> : events.data?.length ? <div className="grid gap-4 md:grid-cols-3">{events.data.slice(0, 3).map((item, i) => <EventTile event={item} key={item.id} index={i} />)}</div> : <div className="rounded-3xl border border-dashed border-[#cfc6b7] p-8 text-center"><p className="font-semibold">Le programme est en préparation.</p><p className="mt-2 text-sm text-[#69756d]">Les prochaines activités apparaîtront ici.</p></div>}
      <Link href="/programme" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#10202b] no-underline md:hidden" data-testid="link-all-events-mobile">Tout le programme <ArrowRight size={15} /></Link>
    </section>
    <section className="my-16 grid gap-5 rounded-[28px] border border-[#d9d0c1] bg-[#e8e1d5] p-6 md:grid-cols-[1fr_1.2fr] md:items-center md:p-9">
      <div><p className="maani-mono text-[10px] uppercase text-[#43805a]">Une inscription, un badge</p><h2 className="maani-display mt-3 text-3xl font-bold md:text-4xl">Garde ton billet à portée de main.</h2></div>
      <div className="flex flex-col gap-4 md:items-end"><p className="max-w-md text-sm leading-6 text-[#59675f] md:text-right">Après ton inscription, retrouve ton badge avec son numéro. Pas besoin de compte, de téléphone ou d'adresse e-mail.</p><Link href="/mon-badge" className="inline-flex items-center gap-2 self-start rounded-full border border-[#10202b] px-5 py-3 text-xs font-semibold text-[#10202b] no-underline md:self-auto" data-testid="link-find-badge-callout">Retrouver mon badge <ArrowRight size={15} /></Link></div>
    </section>
    <span className="sr-only" data-testid="status-service">{health.data?.status || (health.isError ? 'service indisponible' : 'vérification du service')}</span>
  </main></Shell>;
}

function ProgrammePage() {
  const events = useListEvents();
  const activities = useListActivities();
  return <Shell><main className="mx-auto max-w-7xl px-5 py-12 md:px-9 md:py-16">
    <PageIntro eyebrow="À découvrir · Lycée Mustapha El Maani" title={<>Trouve ta<br /><span className="text-[#1fa855]">prochaine activité.</span></>} text="Des rendez-vous pour apprendre, partager et faire vivre le lycée. Choisis un événement et réserve ta place." />
    <div className="mb-12 flex items-center gap-3 border-y border-[#d9d0c1] py-4 text-xs text-[#68746c]"><CalendarDays size={16} className="text-[#1fa855]" /><span>Les inscriptions sont gratuites et ouvertes dans la limite des places disponibles.</span></div>
    <section><div className="mb-7 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-[#1fa855] text-white"><Ticket size={16} /></span><h2 className="text-xl font-bold tracking-[-.04em]">Événements à venir</h2></div>
      {events.isLoading ? <LoadingRows /> : events.isError ? <ErrorBox message={errorText(events.error)} onRetry={() => events.refetch()} /> : events.data?.length ? <div className="grid gap-x-5 gap-y-10 md:grid-cols-3">{events.data.map((event, i) => <EventTile event={event} index={i} key={event.id} />)}</div> : <div className="rounded-[26px] border border-dashed border-[#cfc6b7] bg-[#f8f4ec] px-6 py-12 text-center"><CalendarDays size={24} className="mx-auto text-[#1fa855]" /><h3 className="mt-4 text-lg font-bold">Aucun événement pour l'instant</h3><p className="mt-2 text-sm text-[#667269]">Reviens bientôt pour découvrir les prochains rendez-vous.</p></div>}
    </section>
    <section className="mt-20"><div className="mb-7"><p className="maani-mono text-[10px] uppercase text-[#1fa855]">Toute l'année</p><h2 className="mt-2 text-2xl font-bold tracking-[-.04em]">Les activités du lycée</h2></div>
      {activities.isLoading ? <LoadingRows /> : activities.isError ? <ErrorBox message={errorText(activities.error)} onRetry={() => activities.refetch()} /> : activities.data?.length ? <div className="divide-y divide-[#d9d0c1] border-y border-[#d9d0c1]">{activities.data.map((activity, index) => <ActivityRow key={activity.id} activity={activity} index={index} />)}</div> : <p className="rounded-xl bg-[#e8e1d5] p-5 text-sm text-[#667269]">Les activités régulières seront affichées ici.</p>}
    </section>
  </main></Shell>;
}
function ActivityRow({ activity, index }: { activity: Activity; index: number }) {
  return <article className="grid gap-3 py-6 md:grid-cols-[60px_1fr_1fr] md:items-center" data-testid={`activity-${activity.id}`}><span className="maani-mono text-xs text-[#1fa855]">0{index + 1}</span><div><h3 className="font-bold">{activity.title}</h3><p className="mt-1 text-xs leading-5 text-[#657169]">{activity.description}</p></div><p className="text-xs font-medium text-[#526058] md:text-right">{activity.schedule}</p></article>;
}

function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId) || 0;
  const q = useGetEvent(eventId, { query: { enabled: eventId > 0, queryKey: getGetEventQueryKey(eventId) } });
  const register = useRegisterForEvent();
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState('');
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState('');
  const event = q.data;
  const canRegister = !!event?.isOpen && event.spotsLeft > 0;
  const submit = (e: FormEvent) => {
    e.preventDefault(); setFormError('');
    if (fullName.trim().length < 2 || fullName.trim().length > 100) return setFormError('Indique ton nom complet (2 à 100 caractères).');
    if (!className.trim() || className.trim().length > 40) return setFormError('Indique ta classe (40 caractères maximum).');
    if (!consent) return setFormError('Ton accord est nécessaire pour traiter l’inscription.');
    register.mutate({ eventId, data: { fullName: fullName.trim(), className: className.trim(), consent: true } }, {
      onSuccess: badge => setLocation(`/confirmation/${encodeURIComponent(badge.registrationNumber)}`),
      onError: error => setFormError(errorText(error)),
    });
  };
  return <Shell><main className="mx-auto max-w-6xl px-5 py-10 md:px-9 md:py-16">
    <Link href="/programme" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-[#59675f] no-underline" data-testid="link-back-programme"><ArrowLeft size={15} /> Retour au programme</Link>
    {q.isLoading ? <LoadingRows /> : q.isError || !event ? <ErrorBox message={q.isError ? errorText(q.error) : 'Événement introuvable.'} onRetry={() => q.refetch()} /> : <div className="grid gap-8 md:grid-cols-[1.1fr_.9fr]">
      <section className="maani-enter">
        <p className="maani-mono text-[10px] uppercase text-[#1fa855]">Événement · {fmtDate(event.date)}</p>
        <h1 className="maani-display mt-4 text-5xl font-bold md:text-7xl">{event.title}</h1>
        <div className="mt-7 flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-[#e2ebdf] px-4 py-2 text-xs font-semibold"><Clock3 size={14} />{event.time}</span><span className="inline-flex items-center gap-2 rounded-full bg-[#e2ebdf] px-4 py-2 text-xs font-semibold"><MapPin size={14} />{event.place}</span></div>
        <p className="mt-8 max-w-xl whitespace-pre-wrap text-sm leading-7 text-[#5d6962]">{event.description}</p>
        <div className="mt-10 rounded-[26px] bg-[#10202b] p-6 text-[#f3eee4]"><div className="flex items-center justify-between"><span className="maani-mono text-[10px] uppercase text-[#98d9a8]">Places disponibles</span><Users size={18} className="text-[#98d9a8]" /></div><p className="mt-3 text-4xl font-bold tracking-[-.06em]">{Math.max(event.spotsLeft, 0)}<span className="ml-2 text-base font-medium text-[#bac7be]">/ {event.maxCapacity}</span></p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#1fa855]" style={{ width: `${Math.min(100, event.registeredCount / Math.max(event.maxCapacity, 1) * 100)}%` }} /></div></div>
      </section>
      <section className="h-fit rounded-[28px] border border-[#d9d0c1] bg-[#f9f5ec] p-5 md:p-7">
        <p className="maani-mono text-[10px] uppercase text-[#1fa855]">Réserve ta place</p><h2 className="mt-2 text-2xl font-bold tracking-[-.05em]">Inscription gratuite</h2>
        {canRegister ? <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <label className="block text-xs font-semibold">Nom complet<input className="mt-2 w-full rounded-xl border border-[#d5ccbc] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#1fa855] focus:ring-2 focus:ring-[#1fa855]/20" value={fullName} onChange={e => setFullName(e.target.value)} maxLength={100} autoComplete="name" placeholder="Ex. Salma El Amrani" data-testid="input-full-name" /></label>
          <label className="block text-xs font-semibold">Classe<input className="mt-2 w-full rounded-xl border border-[#d5ccbc] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#1fa855] focus:ring-2 focus:ring-[#1fa855]/20" value={className} onChange={e => setClassName(e.target.value)} maxLength={40} placeholder="Ex. 2e année" data-testid="input-class" /></label>
           <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#ece6da] p-3 text-[11px] leading-5 text-[#59675f]"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 size-4 accent-[#1fa855]" data-testid="input-consent" /><span>J’accepte que mes informations (nom, classe, phone) soient utilisées pour cet évènement et J’accepte également la prise de photos et leur utilisation. <Link href="/confidentialite" className="font-semibold text-[#1b7540] underline" data-testid="link-consent-privacy">En savoir plus</Link>.</span></label>
          {formError && <p role="alert" className="rounded-xl bg-[#fbefeb] p-3 text-xs font-medium text-[#9b4034]" data-testid="status-registration-error">{formError}</p>}
          <button type="submit" disabled={register.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1fa855] px-5 py-4 text-sm font-bold text-white disabled:opacity-55" data-testid="button-register">{register.isPending ? 'Inscription en cours…' : 'Confirmer mon inscription'}<ArrowRight size={16} /></button>
          <p className="text-center text-[10px] text-[#7c867d]">Aucun e-mail, téléphone ou code Massar demandé.</p>
        </form> : <div className="mt-6 rounded-2xl bg-[#ece6da] p-5"><p className="font-semibold">{event.spotsLeft <= 0 ? 'Cet événement est complet.' : 'Les inscriptions sont fermées.'}</p><p className="mt-2 text-xs leading-5 text-[#657169]">Tu peux consulter les autres activités du lycée.</p><Link href="/programme" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#1b7540] no-underline" data-testid="link-other-events">Voir le programme <ArrowRight size={14} /></Link></div>}
      </section>
    </div>}
  </main></Shell>;
}

async function downloadBadgePdf(badge: RegistrationBadge) {
  const badgeElement = document.getElementById('print-badge');
  if (!badgeElement) throw new Error('Badge introuvable.');

  await document.fonts.ready;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(badgeElement, {
    backgroundColor: '#f9f5ec',
    scale: 2,
    useCORS: true,
    logging: false,
    ignoreElements: element => element.hasAttribute('data-html2canvas-ignore'),
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fitScale = Math.min(180 / canvas.width, 265 / canvas.height);
  const width = canvas.width * fitScale;
  const height = canvas.height * fitScale;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (210 - width) / 2, (297 - height) / 2, width, height, undefined, 'FAST');
  pdf.save(`badge-${badge.registrationNumber}.pdf`);
}

function BadgePanel({ badge }: { badge: RegistrationBadge }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const download = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadBadgePdf(badge);
    } catch {
      setDownloadError('Le badge PDF n’a pas pu être généré. Réessaie.');
    } finally {
      setDownloading(false);
    }
  };
  return <div id="print-badge" className="mx-auto max-w-xl rounded-[30px] border border-[#d9d0c1] bg-[#f9f5ec] p-5 shadow-[8px_8px_0_#d5ccbc] md:p-8" data-testid="badge-panel">
    <div className="flex items-start justify-between"><div><p className="maani-mono text-[10px] uppercase text-[#1fa855]">Ton badge · Maani Connect</p><h2 className="mt-2 text-2xl font-bold tracking-[-.04em]">{badge.event.title}</h2></div><span className="grid size-10 place-items-center rounded-xl bg-[#dcebdc] text-[#1fa855]"><QrCode size={20} /></span></div>
    <div className="mt-6 grid gap-5 border-y border-dashed border-[#d5ccbc] py-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-[10px] uppercase tracking-[.1em] text-[#758077]">Participant·e</p><p className="mt-1 text-lg font-bold">{badge.fullName}</p><p className="text-sm text-[#667269]">{badge.className}</p><p className="mt-4 text-xs text-[#667269]">{fmtDate(badge.event.date)} · {badge.event.time}</p><p className="mt-1 text-xs text-[#667269]">{badge.event.place}</p></div><div className="rounded-2xl bg-[#e9e4d9] p-3"><QRCodeCanvas value={badge.registrationNumber} /></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4"><div><p className="text-[9px] uppercase tracking-[.12em] text-[#758077]">Numéro de badge</p><p className="maani-mono mt-1 text-sm font-medium" data-testid="text-registration-number">{badge.registrationNumber}</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-[#e2efdf] px-3 py-2 text-[10px] font-bold capitalize text-[#277044]"><CheckCircle2 size={13} />{badge.status === 'present' ? 'Présent·e' : badge.status === 'cancelled' ? 'Annulé' : 'Inscrit·e'}</span></div>
     {downloadError && <p role="alert" className="mt-4 text-xs text-[#a54537]" data-html2canvas-ignore="true">{downloadError}</p>}
     <button onClick={download} disabled={downloading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#10202b] px-5 py-3.5 text-sm font-semibold text-[#f3eee4] disabled:opacity-60" data-html2canvas-ignore="true" data-testid="button-download-badge"><Download size={16} /> {downloading ? 'Préparation du badge…' : 'Télécharger le badge PDF'}</button>
  </div>;
}
function QRCodeCanvas({ value }: { value: string }) {
  const matrix = encodeBadgeQr(value);
  const path = matrix.flatMap((row, y) => row.flatMap((dark, x) => dark ? [`M${x},${y}h1v1h-1z`] : [])).join('');
  return <svg role="img" aria-label={`Code QR du badge ${value}`} viewBox="-4 -4 41 41" width="128" height="128" shapeRendering="crispEdges" data-testid="img-badge-qr"><rect x="-4" y="-4" width="41" height="41" fill="#f9f5ec" /><path d={path} fill="#10202b" /></svg>;
}

function ConfirmationPage() {
  const params = useParams<{ registrationNumber: string }>();
  const number = decodeURIComponent(params.registrationNumber || '');
  const badgeQuery = useGetRegistrationBadge(number, { query: { enabled: !!number, queryKey: getGetRegistrationBadgeQueryKey(number) } });
  return <Shell><main className="mx-auto max-w-4xl px-5 py-12 md:px-9 md:py-16">
    <div className="mb-9 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-[#dcebdc] text-[#1fa855]"><Check size={26} /></span><p className="maani-mono mt-5 text-[10px] uppercase text-[#1fa855]">C’est noté</p><h1 className="maani-display mt-2 text-4xl font-bold md:text-5xl">Ta place est réservée.</h1><p className="mt-3 text-sm text-[#667269]">Garde ce badge pour le jour de l’événement.</p></div>
    {badgeQuery.isLoading ? <LoadingRows /> : badgeQuery.isError ? <ErrorBox message={errorText(badgeQuery.error)} onRetry={() => badgeQuery.refetch()} /> : badgeQuery.data && <BadgePanel badge={badgeQuery.data} />}
    <p className="mx-auto mt-8 max-w-md text-center text-xs leading-6 text-[#707b73]">Tu peux retrouver ce badge à tout moment avec son numéro depuis la page <Link href="/mon-badge" className="font-semibold text-[#1b7540] underline" data-testid="link-badge-lookup">Mon badge</Link>.</p>
  </main></Shell>;
}

function BadgeLookupPage() {
  const [draft, setDraft] = useState('');
  const [number, setNumber] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState('');
  const query = useGetRegistrationBadge(number, { query: { enabled: !!number, queryKey: getGetRegistrationBadgeQueryKey(number) } });
  const cancel = useCancelOwnRegistration();
  const submit = (e: FormEvent) => { e.preventDefault(); const normalized = draft.trim(); if (normalized.length < 3) { setNotice('Saisis le numéro inscrit sur ton badge.'); return; } setNotice(''); setConfirmCancel(false); setNumber(normalized); };
  return <Shell><main className="mx-auto max-w-5xl px-5 py-12 md:px-9 md:py-16"><PageIntro eyebrow="Badge étudiant·e" title={<>Ton badge, <span className="text-[#1fa855]">à nouveau.</span></>} text="Saisis le numéro de badge reçu après ton inscription. Tu pourras le télécharger ou annuler ta participation." />
    <div className="grid gap-8 md:grid-cols-[.8fr_1.2fr]"><section className="h-fit rounded-[26px] bg-[#10202b] p-6 text-[#f3eee4]"><span className="grid size-11 place-items-center rounded-xl bg-[#1fa855]"><Search size={19} /></span><h2 className="mt-5 text-xl font-bold">Retrouver mon badge</h2><form onSubmit={submit} className="mt-5 space-y-3"><label htmlFor="badge-number" className="block text-xs font-semibold">Numéro de badge</label><input id="badge-number" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ex. MAANI-…" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-[#85d99c]" data-testid="input-badge-number" />{notice && <p role="alert" className="text-xs text-[#ffc3b8]" data-testid="status-lookup-error">{notice}</p>}<button type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1fa855] px-5 py-3.5 text-sm font-bold text-white" data-testid="button-find-badge">Chercher <ArrowRight size={15} /></button></form><div className="mt-6 flex gap-2 border-t border-white/15 pt-4 text-[10px] leading-5 text-[#bdc9c0]"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#98d9a8]" />Ton numéro est uniquement utilisé pour afficher ton inscription.</div></section>
      <section>{query.isFetching && <LoadingRows />}{query.isError && <ErrorBox message={errorText(query.error)} onRetry={() => query.refetch()} />}{query.data && <><BadgePanel badge={query.data} />{query.data.status !== 'cancelled' && <div className="mt-5 rounded-2xl border border-[#d9d0c1] bg-[#f9f5ec] p-5">{confirmCancel ? <><p className="text-sm font-semibold">Annuler cette inscription ?</p><p className="mt-1 text-xs text-[#667269]">Cette action libérera ta place et ne peut pas être annulée.</p><div className="mt-4 flex gap-3"><button onClick={() => setConfirmCancel(false)} className="rounded-full border border-[#d5ccbc] px-4 py-2 text-xs font-semibold" data-testid="button-cancel-keep">Garder ma place</button><button disabled={cancel.isPending} onClick={() => cancel.mutate({ registrationNumber: number }, { onSuccess: () => { setConfirmCancel(false); query.refetch(); setNotice('Inscription annulée.'); }, onError: err => setNotice(errorText(err)) })} className="rounded-full bg-[#a54537] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50" data-testid="button-cancel-confirm">{cancel.isPending ? 'Annulation…' : 'Oui, annuler'}</button></div></> : <button onClick={() => { setNotice(''); setConfirmCancel(true); }} className="text-xs font-semibold text-[#a54537] underline underline-offset-4" data-testid="button-cancel-registration">Annuler ma participation</button>}{notice && !confirmCancel && <p role="status" className="mt-3 text-xs text-[#287348]" data-testid="status-cancel-result">{notice}</p>}</div>}</>}</section>
    </div></main></Shell>;
}

function ArchivePage() {
  const archive = useListPublicArchive();
  return <Shell><main className="mx-auto max-w-5xl px-5 py-12 md:px-9 md:py-16"><PageIntro eyebrow="Les moments passés" title={<>Une histoire qui<br /><span className="text-[#1fa855]">continue.</span></>} text="Retrouve les événements qui ont déjà rassemblé la communauté du lycée." />
    {archive.isLoading ? <LoadingRows /> : archive.isError ? <ErrorBox message={errorText(archive.error)} onRetry={() => archive.refetch()} /> : archive.data?.length ? <div className="border-y border-[#d9d0c1]">{archive.data.map((item, i) => <article className="grid grid-cols-[54px_1fr] gap-4 border-b border-[#d9d0c1] py-5 last:border-0 md:grid-cols-[70px_1fr_auto] md:items-center" key={item.id} data-testid={`archive-event-${item.id}`}><span className="maani-mono pt-1 text-[10px] text-[#1fa855]">0{i + 1}</span><h2 className="text-base font-semibold tracking-[-.03em] md:text-lg">{item.title}</h2><time className="col-start-2 text-xs text-[#69756d] md:col-start-3">{fmtDate(item.date)}</time></article>)}</div> : <div className="rounded-3xl border border-dashed border-[#cfc6b7] p-10 text-center"><CalendarDays className="mx-auto text-[#1fa855]" /><p className="mt-4 font-semibold">L’archive se remplit au fil des rencontres.</p><p className="mt-2 text-sm text-[#69756d]">Aucun événement passé pour le moment.</p></div>}
    <p className="mt-6 flex items-center gap-2 text-[10px] text-[#778178]"><LockKeyhole size={13} />Cette page n’affiche que les titres et les dates.</p>
  </main></Shell>;
}

function PrivacyPage() {
  return <Shell><main className="mx-auto max-w-3xl px-5 py-12 md:px-9 md:py-16"><PageIntro eyebrow="Informations · vie privée" title={<>Tes données, <span className="text-[#1fa855]">avec soin.</span></>} text="Maani Connect collecte uniquement les informations nécessaires au fonctionnement des activités du lycée." />
    <div className="space-y-8 rounded-[28px] border border-[#d9d0c1] bg-[#f9f5ec] p-6 md:p-9">
      {[['Ce qui est demandé', 'Pour réserver une place, nous demandons ton nom complet et ta classe. Aucun code Massar, numéro de téléphone ou adresse e-mail n’est demandé.'], ['Pourquoi', 'Ces informations servent à gérer les inscriptions et à vérifier les présences lors de l’événement. Les photos sont prises et utilisées uniquement selon l’accord demandé lors de l’inscription.'], ['Ton badge', 'Le numéro de badge te permet de retrouver ton inscription, de télécharger ton badge ou de demander l’annulation. Garde ce numéro pour toi.'], ['Conservation', 'Les données personnelles d’inscription sont supprimées automatiquement six mois après l’événement par défaut. L’administration peut modifier cette durée ; seuls les compteurs d’inscriptions et de présences sont conservés ensuite.'], ['Accès', 'Les informations des participants sont accessibles uniquement aux administrateurs autorisés du lycée. L’archive publique ne contient que le titre et la date des événements passés.']].map(([title, body], i) => <section key={title} className="grid gap-2 sm:grid-cols-[32px_1fr]"><span className="maani-mono text-[10px] text-[#1fa855]">0{i + 1}</span><div><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm leading-7 text-[#5d6962]">{body}</p></div></section>)}
      <p className="border-t border-[#d9d0c1] pt-5 text-xs leading-6 text-[#758077]">Pour toute question concernant une inscription, retrouve ton badge et annule-la si nécessaire depuis <Link href="/mon-badge" className="font-semibold text-[#1b7540] underline" data-testid="link-privacy-badge">la page Mon badge</Link>.</p>
    </div></main></Shell>;
}

function AdminPage() {
  const auth = useAuth();
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<'events' | 'archive' | 'settings'>('events');
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<AdminEvent | null>(null);
  if (auth.isLoading) return <Shell><main className="mx-auto max-w-4xl px-5 py-20"><div className="h-48 animate-pulse rounded-[28px] bg-[#e6dfd3]" /></main></Shell>;
  if (!auth.isAuthenticated) return <AdminLogin login={auth.login} />;
  return <AdminDashboard user={auth.user} logout={auth.logout} tab={tab} setTab={setTab} selected={selected} setSelected={setSelected} createOpen={createOpen} setCreateOpen={setCreateOpen} edit={edit} setEdit={setEdit} />;
}
function AdminLogin({ login }: { login: () => void }) {
  return <div className="maani-shell"><div className="maani-content"><header className="border-b border-[#d9d0c1] px-5 py-4"><Brand /></header><main className="mx-auto grid min-h-[72dvh] max-w-5xl items-center gap-10 px-5 py-12 md:grid-cols-[1fr_.8fr] md:px-9"><section><p className="maani-mono text-[10px] uppercase text-[#1fa855]">Espace réservé</p><h1 className="maani-display mt-4 text-5xl font-bold md:text-7xl">L’équipe<br />du lycée.</h1><p className="mt-6 max-w-md text-sm leading-7 text-[#5d6962]">Gère les événements, les inscriptions et les présences depuis l’espace administration sécurisé.</p></section><section className="rounded-[28px] bg-[#10202b] p-7 text-[#f3eee4]"><span className="grid size-12 place-items-center rounded-2xl bg-[#1fa855]"><LockKeyhole size={20} /></span><h2 className="mt-6 text-2xl font-bold tracking-[-.04em]">Connexion administrateur</h2><p className="mt-3 text-sm leading-6 text-[#bfcbc3]">Connecte-toi avec ton compte autorisé par l’administration du lycée.</p><button onClick={login} className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-[#1fa855] px-5 py-4 text-sm font-bold text-white" data-testid="button-admin-login">Se connecter <ArrowRight size={16} /></button><p className="mt-5 text-[10px] leading-5 text-[#9eada3]">L’accès est contrôlé côté serveur. Les comptes non autorisés ne peuvent pas gérer les données.</p></section></main><Footer /></div></div>;
}
type DashboardProps = { user: { firstName?: string | null; lastName?: string | null } | null; logout: () => void; tab: 'events' | 'archive' | 'settings'; setTab: (tab: 'events' | 'archive' | 'settings') => void; selected: number | null; setSelected: (id: number | null) => void; createOpen: boolean; setCreateOpen: (value: boolean) => void; edit: AdminEvent | null; setEdit: (event: AdminEvent | null) => void };
function AdminDashboard(props: DashboardProps) {
  const events = useListAdminEvents();
  const archive = useListAdminArchive({ query: { enabled: props.tab === 'archive', queryKey: getListAdminArchiveQueryKey() } });
  const settings = useGetAdminSettings({ query: { enabled: props.tab === 'settings', queryKey: getGetAdminSettingsQueryKey() } });
  const displayName = [props.user?.firstName, props.user?.lastName].filter(Boolean).join(' ') || 'Administration';
  return <div className="maani-shell"><div className="maani-content">
    <header className="border-b border-[#d9d0c1] bg-[#f3eee4]"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-9"><Brand /><div className="flex items-center gap-3"><span className="hidden text-xs font-medium text-[#59675f] sm:block">{displayName}</span><button onClick={props.logout} className="rounded-full border border-[#cfc6b7] px-4 py-2 text-xs font-semibold" data-testid="button-admin-logout">Déconnexion</button></div></div></header>
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-9 md:py-12">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="maani-mono text-[10px] uppercase text-[#1fa855]">Gestion du lycée</p><h1 className="maani-display mt-2 text-4xl font-bold md:text-5xl">Administration</h1></div>{props.tab === 'events' && <button onClick={() => props.setCreateOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1fa855] px-5 py-3 text-sm font-bold text-white" data-testid="button-create-event">Créer un événement <span className="text-lg">+</span></button>}</div>
      <nav className="mb-8 flex gap-2 overflow-x-auto border-b border-[#d9d0c1] pb-3">{([['events', 'Événements'], ['archive', 'Archives'], ['settings', 'Conservation']] as const).map(([id, label]) => <button key={id} onClick={() => props.setTab(id)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${props.tab === id ? 'bg-[#10202b] text-[#f3eee4]' : 'text-[#59675f] hover:bg-[#e8e1d5]'}`} data-testid={`button-admin-tab-${id}`}>{label}</button>)}</nav>
      {props.tab === 'events' && <AdminEvents events={events.data || []} loading={events.isLoading} error={events.isError ? errorText(events.error) : ''} retry={() => events.refetch()} selected={props.selected} setSelected={props.setSelected} edit={props.setEdit} />}
      {props.tab === 'archive' && <AdminArchive data={archive.data || []} loading={archive.isLoading} error={archive.isError ? errorText(archive.error) : ''} retry={() => archive.refetch()} />}
      {props.tab === 'settings' && <AdminRetention data={settings.data} loading={settings.isLoading} error={settings.isError ? errorText(settings.error) : ''} retry={() => settings.refetch()} />}
    </main>
    <Footer />
    {props.createOpen && <EventEditor onClose={() => props.setCreateOpen(false)} />}
    {props.edit && <EventEditor event={props.edit} onClose={() => props.setEdit(null)} />}
  </div></div>;
}
function AdminEvents({ events, loading, error, retry, selected, setSelected, edit }: { events: AdminEvent[]; loading: boolean; error: string; retry: () => void; selected: number | null; setSelected: (id: number | null) => void; edit: (event: AdminEvent) => void }) {
  const chosen = events.find(event => event.id === selected) || null;
  if (loading) return <LoadingRows />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  return <div className="grid gap-7 lg:grid-cols-[.8fr_1.2fr]">
    <section className="space-y-3">{events.length ? events.map(event => <button key={event.id} onClick={() => setSelected(event.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selected === event.id ? 'border-[#1fa855] bg-[#e6f0e4]' : 'border-[#d9d0c1] bg-[#f9f5ec] hover:border-[#aab7aa]'}`} data-testid={`button-select-admin-event-${event.id}`}><span className="flex items-start justify-between gap-4"><span><b className="block text-sm">{event.title}</b><span className="mt-1 block text-[10px] text-[#68746c]">{fmtDate(event.date)} · {event.time}</span></span><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${event.isOpen ? 'bg-[#e0efdf] text-[#277044]' : 'bg-[#ede6d9] text-[#6d685b]'}`}>{event.isOpen ? 'Ouvert' : 'Fermé'}</span></span><span className="mt-4 flex justify-between text-[10px] text-[#667269]"><span>{event.registeredCount} inscrits</span><span>{event.presentCount} présents</span><span>{event.spotsLeft} places</span></span></button>) : <div className="rounded-2xl border border-dashed border-[#cfc6b7] p-7 text-center text-sm text-[#667269]">Aucun événement créé.</div>}</section>
    {chosen ? <AdminEventDetail event={chosen} onEdit={() => edit(chosen)} /> : <div className="flex min-h-64 items-center justify-center rounded-[24px] border border-dashed border-[#cfc6b7] text-center"><div><Users className="mx-auto text-[#1fa855]" /><p className="mt-3 text-sm font-semibold">Sélectionne un événement</p><p className="mt-1 text-xs text-[#748077]">Les inscriptions et présences s’afficheront ici.</p></div></div>}
  </div>;
}
function AdminEventDetail({ event, onEdit }: { event: AdminEvent; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const rows = useListEventRegistrations(event.id, { query: { queryKey: getListEventRegistrationsQueryKey(event.id) } });
  const update = useUpdateRegistrationStatus();
  const exportCsv = useExportEventRegistrations(event.id, { query: { enabled: false, queryKey: getExportEventRegistrationsQueryKey(event.id) } });
  const updateEvent = useUpdateEvent();
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState('');
  const filtered = (rows.data || []).filter(row => `${row.fullName} ${row.className} ${row.registrationNumber}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
  const doStatus = (row: RegistrationRow, status: 'present' | 'cancelled') => {
    setActionError('');
    update.mutate({ registrationNumber: row.registrationNumber, data: { status } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventRegistrationsQueryKey(event.id) }); queryClient.invalidateQueries({ queryKey: getListAdminEventsQueryKey() }); },
      onError: err => setActionError(errorText(err)),
    });
  };
  const doExport = async () => {
    setActionError('');
    try { const csv = await exportCsv.refetch(); const value = csv.data; if (!value) throw new Error('Aucun fichier à télécharger.'); const blob = new Blob([value], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `inscriptions-${event.id}.csv`; a.click(); URL.revokeObjectURL(url); } catch (err) { setActionError(errorText(err)); }
  };
  return <section className="overflow-hidden rounded-[24px] border border-[#d9d0c1] bg-[#f9f5ec]">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#d9d0c1] p-5"><div><p className="maani-mono text-[9px] uppercase text-[#1fa855]">{fmtDate(event.date)} · {event.time}</p><h2 className="mt-2 text-xl font-bold">{event.title}</h2><p className="mt-1 text-xs text-[#667269]">{event.place} · {event.presentCount} présents / {event.registeredCount} inscrits</p></div><div className="flex gap-2"><button onClick={onEdit} className="rounded-full border border-[#cfc6b7] px-3 py-2 text-[10px] font-semibold" data-testid="button-edit-event">Modifier</button><button onClick={() => updateEvent.mutate({ eventId: event.id, data: { isOpen: !event.isOpen } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAdminEventsQueryKey() }), onError: err => setActionError(errorText(err)) })} className="rounded-full bg-[#10202b] px-3 py-2 text-[10px] font-semibold text-white" data-testid="button-toggle-event">{event.isOpen ? 'Fermer' : 'Ouvrir'}</button></div></div>
    <div className="flex flex-col gap-3 p-4 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a857c]" size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un participant" className="w-full rounded-xl border border-[#d9d0c1] bg-[#fffdf8] py-3 pl-9 pr-3 text-xs outline-none focus:border-[#1fa855]" data-testid="input-search-registrants" /></label><button onClick={doExport} disabled={exportCsv.isFetching} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cfc6b7] px-4 py-3 text-xs font-semibold disabled:opacity-50" data-testid="button-export-csv"><ArrowDownToLine size={15} />{exportCsv.isFetching ? 'Préparation…' : 'Exporter CSV'}</button></div>
    {actionError && <p role="alert" className="mx-4 rounded-lg bg-[#fbefeb] p-3 text-xs text-[#9b4034]" data-testid="status-admin-action-error">{actionError}</p>}
    <div className="px-4 pb-4">{rows.isLoading ? <LoadingRows /> : rows.isError ? <ErrorBox message={errorText(rows.error)} onRetry={() => rows.refetch()} /> : filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[530px] text-left text-xs"><thead><tr className="border-b border-[#ded6c9] text-[9px] uppercase tracking-[.08em] text-[#778178]"><th className="px-2 py-3">Participant</th><th className="px-2 py-3">N° badge</th><th className="px-2 py-3">État</th><th className="px-2 py-3 text-right">Action</th></tr></thead><tbody>{filtered.map(row => <tr key={row.registrationNumber} className="border-b border-[#e6dfd3] last:border-0" data-testid={`row-registrant-${row.registrationNumber}`}><td className="px-2 py-3"><b className="block">{row.fullName}</b><span className="mt-1 block text-[10px] text-[#7b857d]">{row.className} · {fmtDate(row.createdAt.slice(0, 10))}</span></td><td className="maani-mono px-2 py-3 text-[9px]">{row.registrationNumber}</td><td className="px-2 py-3"><span className="rounded-full bg-[#e7e9dd] px-2 py-1 text-[9px] capitalize">{row.status}</span></td><td className="px-2 py-3 text-right">{row.status === 'registered' && <button disabled={update.isPending} onClick={() => doStatus(row, 'present')} className="rounded-full bg-[#1fa855] px-3 py-2 text-[9px] font-bold text-white disabled:opacity-50" data-testid={`button-mark-present-${row.registrationNumber}`}>Présent·e</button>}{row.status !== 'cancelled' && <button disabled={update.isPending} onClick={() => doStatus(row, 'cancelled')} className="ml-2 text-[9px] font-semibold text-[#a54537] underline" data-testid={`button-admin-cancel-${row.registrationNumber}`}>Annuler</button>}</td></tr>)}</tbody></table></div> : <p className="py-9 text-center text-xs text-[#69756d]">{search ? 'Aucun participant trouvé.' : 'Aucune inscription pour le moment.'}</p>}</div>
  </section>;
}

function EventEditor({ event, onClose }: { event?: AdminEvent; onClose: () => void }) {
  const queryClient = useQueryClient();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const [form, setForm] = useState({ title: event?.title || '', description: event?.description || '', date: event?.date || '', time: event?.time || '', place: event?.place || '', maxCapacity: String(event?.maxCapacity || '') });
  const [error, setError] = useState('');
  const pending = create.isPending || update.isPending;
  const submit = (e: FormEvent) => {
    e.preventDefault(); setError('');
    const capacity = Number(form.maxCapacity);
    if (form.title.trim().length < 2 || !form.date || !form.time || form.place.trim().length < 2 || !Number.isInteger(capacity) || capacity < 1 || capacity > 5000) { setError('Vérifie le titre, la date, l’heure, le lieu et la capacité (1 à 5 000).'); return; }
    const data = { title: form.title.trim(), description: form.description.trim(), date: form.date, time: form.time, place: form.place.trim(), maxCapacity: capacity };
    const onSuccess = () => { queryClient.invalidateQueries({ queryKey: getListAdminEventsQueryKey() }); queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() }); onClose(); };
    if (event) update.mutate({ eventId: event.id, data }, { onSuccess, onError: err => setError(errorText(err)) });
    else create.mutate({ data }, { onSuccess, onError: err => setError(errorText(err)) });
  };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#10202b]/55 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={event ? 'Modifier un événement' : 'Créer un événement'}><form onSubmit={submit} className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-[#f3eee4] p-5 shadow-2xl sm:rounded-[28px] sm:p-7">
    <div className="mb-6 flex items-start justify-between"><div><p className="maani-mono text-[10px] uppercase text-[#1fa855]">Administration</p><h2 className="mt-2 text-2xl font-bold">{event ? 'Modifier l’événement' : 'Nouvel événement'}</h2></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full border border-[#d5ccbc]" aria-label="Fermer" data-testid="button-close-event-editor"><X size={17} /></button></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold sm:col-span-2">Titre<input required maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-2 w-full rounded-xl border border-[#d5ccbc] bg-[#fffdf8] px-4 py-3 text-sm" data-testid="input-event-title" /></label><label className="text-xs font-semibold sm:col-span-2">Description<textarea maxLength={2000} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-2 w-full resize-y rounded-xl border border-[#d5ccbc] bg-[#fffdf8] px-4 py-3 text-sm" data-testid="input-event-description" /></label><label className="text-xs font-semibold">Date<input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-2 w-full rounded-xl border border-[#d5ccbc] bg-[#fffdf8] px-3 py-3 text-sm" data-testid="input-event-date" /></label><label className="text-xs font-semibold">Heure<input required value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} placeholder="10:30" maxLength={30} className="mt-2 w-full rounded-xl border border-[#d5ccbc] bg-[#fffdf8] px-3 py-3 text-sm" data-testid="input-event-time" /></label><label className="text-xs font-semibold">Lieu<input required maxLength={160} value={form.place} onChange={e => setForm({ ...form, place: e.target.value })} className="mt-2 w-full rounded-xl border border-[#d5ccbc] bg-[#fffdf8] px-3 py-3 text-sm" data-testid="input-event-place" /></label><label className="text-xs font-semibold">Capacité<input type="number" required min={1} max={5000} value={form.maxCapacity} onChange={e => setForm({ ...form, maxCapacity: e.target.value })} className="mt-2 w-full rounded-xl border border-[#d5ccbc] bg-[#fffdf8] px-3 py-3 text-sm" data-testid="input-event-capacity" /></label></div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-[#fbefeb] p-3 text-xs text-[#9b4034]" data-testid="status-event-editor-error">{error}</p>}<div className="mt-6 flex gap-3"><button type="button" onClick={onClose} className="flex-1 rounded-full border border-[#cfc6b7] px-4 py-3 text-xs font-semibold" data-testid="button-event-editor-cancel">Annuler</button><button disabled={pending} className="flex-1 rounded-full bg-[#1fa855] px-4 py-3 text-xs font-bold text-white disabled:opacity-50" data-testid="button-event-editor-save">{pending ? 'Enregistrement…' : event ? 'Enregistrer' : 'Créer l’événement'}</button></div>
  </form></div>;
}
function AdminArchive({ data, loading, error, retry }: { data: { id: number; title: string; date: string; registeredCount: number; presentCount: number }[]; loading: boolean; error: string; retry: () => void }) {
  if (loading) return <LoadingRows />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  return data.length ? <div className="overflow-x-auto rounded-[24px] border border-[#d9d0c1] bg-[#f9f5ec]"><table className="w-full min-w-[500px] text-left text-sm"><thead><tr className="border-b border-[#d9d0c1] text-[10px] uppercase tracking-[.08em] text-[#778178]"><th className="px-5 py-4">Événement</th><th className="px-5 py-4">Date</th><th className="px-5 py-4">Inscrits</th><th className="px-5 py-4">Présents</th></tr></thead><tbody>{data.map(item => <tr key={item.id} className="border-b border-[#e6dfd3] last:border-0" data-testid={`admin-archive-${item.id}`}><td className="px-5 py-4 font-semibold">{item.title}</td><td className="px-5 py-4 text-xs text-[#667269]">{fmtDate(item.date)}</td><td className="px-5 py-4">{item.registeredCount}</td><td className="px-5 py-4">{item.presentCount}</td></tr>)}</tbody></table></div> : <p className="rounded-2xl border border-dashed border-[#cfc6b7] p-8 text-center text-sm text-[#667269]">Aucun événement archivé.</p>;
}
function AdminRetention({ data, loading, error, retry }: { data?: { retentionMonths: number }; loading: boolean; error: string; retry: () => void }) {
  const queryClient = useQueryClient();
  const mutation = useUpdateAdminSettings();
  const [value, setValue] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (data) setValue(String(data.retentionMonths)); }, [data]);
  if (loading) return <LoadingRows />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  const submit = (e: FormEvent) => { e.preventDefault(); const months = Number(value); if (!Number.isInteger(months) || months < 1 || months > 60) { setNotice('La durée doit être comprise entre 1 et 60 mois.'); return; } setNotice(''); mutation.mutate({ data: { retentionMonths: months } }, { onSuccess: () => { setNotice('Durée de conservation mise à jour.'); queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() }); }, onError: err => setNotice(errorText(err)) }); };
  return <section className="max-w-2xl rounded-[24px] border border-[#d9d0c1] bg-[#f9f5ec] p-6 md:p-8"><span className="grid size-11 place-items-center rounded-xl bg-[#e4eddf] text-[#1fa855]"><ShieldCheck size={20} /></span><h2 className="mt-5 text-xl font-bold">Durée de conservation</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[#647068]">Définis la durée de conservation des données d’inscription après un événement, conformément aux règles du lycée.</p><form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-xs font-semibold">Durée en mois<input type="number" min={1} max={60} value={value} onChange={e => setValue(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d5ccbc] bg-[#fffdf8] px-4 py-3 text-sm" data-testid="input-retention-months" /></label><button disabled={mutation.isPending} className="rounded-full bg-[#1fa855] px-5 py-3.5 text-xs font-bold text-white disabled:opacity-50" data-testid="button-save-retention">{mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}</button></form>{notice && <p role="status" className={`mt-4 text-xs ${notice.includes('mise à jour') ? 'text-[#277044]' : 'text-[#9b4034]'}`} data-testid="status-retention">{notice}</p>}</section>;
}

function Router() {
  return <Switch>
    <Route path="/" component={HomePage} />
    <Route path="/programme" component={ProgrammePage} />
    <Route path="/evenements/:eventId" component={EventDetailPage} />
    <Route path="/confirmation/:registrationNumber" component={ConfirmationPage} />
    <Route path="/mon-badge" component={BadgeLookupPage} />
    <Route path="/archive" component={ArchivePage} />
    <Route path="/confidentialite" component={PrivacyPage} />
    <Route path="/admin" component={AdminPage} />
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}

export default App;
