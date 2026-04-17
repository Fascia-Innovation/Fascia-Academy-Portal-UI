# View-by-View Review Notes

## Vy 1: My Overview (/my-overview)

### Sections & Triggers
1. **Header** — "Welcome back, {firstName}" + subtitle "Your personal performance overview — last 6 months"
   - Trigger: `useDashAuth()` provides user name
   
2. **KPI Cards (4 cards)**
   - Upcoming Courses: counts from `courseDates` table where courseLeaderName matches and startDate > NOW() and published = true
   - Participants (this month): from GHL appointments with status "showed" on leader's calendars
   - Total Payout SEK (6 mo): calculated from buildParticipantBreakdown for each showed appointment
   - Total Payout EUR (6 mo): same as above for EUR calendars
   - Trigger: `trpc.courseLeader.myOverview.useQuery()` — calls GHL getCalendars() + getAllAppointments() for 6 months

3. **Participants Over Time bar chart** — CSS bar chart showing monthly participant counts
   - Trigger: same query, `monthlyStats` array

4. **Monthly Breakdown table** — Month | Participants | Payout SEK | Payout EUR with totals
   - Trigger: same query

5. **Motivational note** — "Total participants trained: X in the last 6 months"

### Issues Found
1. **GHL 429 Rate Limit** — The myOverview procedure calls getCalendars() once, then getAllAppointments() for EACH of 6 months. Each getAllAppointments() calls getCalendars() again + fetches events per calendar. This is extremely API-heavy and triggers rate limits.
   - FIX: The error is shown as raw error message. Should show a friendlier retry UI.
   
2. **Upcoming Courses query uses `published = true`** — But with the new workflow, courses use status field (pending_approval, approved, etc.). Should check `status = 'approved'` instead of `published = true`.

3. **Calendar matching logic** — Uses `extractCourseLeaderName(c.name)` or `ghlContactId` to match calendars. If Victor's ghlContactId is set to a calendar ID, it should work. Need to verify this is set correctly.

4. **Quick Links for Course Leaders** — Still points to old GHL forms:
   - "Course Registration" → old GHL form (should use in-app registration)
   - "Course Cancellation" → old GHL form (should use in-app cancel button)
   - "Request New Location" → old GHL form (could be kept or replaced)

5. **Sidebar nav** — Course leader sees: My Overview, My Courses, My Settlements, My Commissions (if affiliate)
   - Missing: No "My Commissions" visible even though user is affiliate — need to check if isAffiliate flag is set
