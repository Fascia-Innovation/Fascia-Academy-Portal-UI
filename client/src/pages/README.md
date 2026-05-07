# client/src/pages/ — Sidkomponenter

## Ansvar

Varje fil motsvarar en route i appen. Sidkomponenter hanterar layout, state och anropar tRPC-hooks för data.

## Ansvarar INTE för

- Backend-logik eller databasåtkomst
- Återanvändbara UI-primitiver (de ligger i `components/ui/`)
- Routing-konfiguration (det ligger i `App.tsx`)

## Viktiga filer

### Admin-sidor
| Fil | Beskrivning |
|-----|-------------|
| `AdminHome.tsx` | KPI-dashboard med statistik |
| `AdminOverview.tsx` | Översikt alla kurser |
| `PendingActions.tsx` | Godkänna/avslå kursregistreringar |
| `CoursesAdmin.tsx` | Kursadministration |
| `Settlements.tsx` | Avräkningshantering |
| `ExamQueue.tsx` | Bedöma examenssubmissioner |
| `UserManagement.tsx` | Hantera användare |
| `CertificateTemplates.tsx` | Certifikatmallar |
| `IssuedCertificates.tsx` | Utfärdade certifikat |
| `SettingsPage.tsx` | Portalinställningar |

### Kursledar-sidor
| Fil | Beskrivning |
|-----|-------------|
| `MyCourses.tsx` | Registrera, omboka, avboka kurser (~1754 rader, kandidat för uppdelning) |
| `CourseDates.tsx` | Kalendervy över egna kurser |
| `MyOverview.tsx` | Kursledarens översikt |
| `MyCommissions.tsx` | Se egna provisioner |

### Publika sidor
| Fil | Beskrivning |
|-----|-------------|
| `PublicCourses.tsx` | Publik bokningssida (kalender, karta, kursledare) |
| `CertificatePublic.tsx` | Verifiera certifikat publikt |
| `Login.tsx` | Inloggning |
| `ResetPassword.tsx` | Lösenordsåterställning |

### Guide
| Fil | Beskrivning |
|-----|-------------|
| `guide/GuideIndex.tsx` | Guideöversikt |
| `guide/Del1-7*.tsx` | Interaktiva guidesektioner |

## Lokala beroenden

- `client/src/lib/trpc.ts` — tRPC-hooks
- `client/src/components/` — UI-komponenter
- `client/src/contexts/` — Auth-context
- `@/components/ui/*` — shadcn/ui

## Vanliga ändringar

1. **Ny sida:** Skapa fil här, registrera route i `App.tsx`, lägg till nav i `DashboardLayout.tsx`
2. **UI-ändring:** Ändra direkt i relevant sidkomponent
3. **Ny data:** Anropa `trpc.*.useQuery/useMutation`

## Saker som INTE ska ändras utan godkännande

- `PublicCourses.tsx` — publik sida, synlig för alla besökare
- Bokningsflödet (GHL-widget-URL:er)
