# What each test does
(Generated from the test names. Run `pnpm exec playwright test --list` for the same list in the terminal.)

## api/server-routes.spec.ts

**LTA routes**
- GET /api/allBusStops returns a big list with the expected fields
- bus stop codes are unique 5-digit strings
- all stops are inside Singapore
- GET /api/allRoutes returns routes with service, direction and distance
- GET /api/busArrivals for a real stop returns a Services array
- GET /api/busArrivals without a stop code does not return a server crash page

**OneMap route**
- GET /api/onemap finds a known address
- nonsense search gives an empty list, not an error
- a search shorter than 3 characters returns an empty list
- no search value returns an empty list

**OpenStreetMap-backed routes (slow)**
- GET /api/allAmenities maps stop codes to categories
- GET /api/stops/[code]/places lists nearby places with distances
- an unknown stop code is a clean 4xx, not a crash

## app/pages.spec.ts

**passport**

**with no trips**
- shows the title and an empty state with a link to spin
- "Spin a trip" goes to /home

**with saved trips**
- shows how many trips are saved
- the empty state is not shown
- the stamp wall is rendered

**profile**
- shows the title and the three tabs
- the cards tab is selected first
- switching tabs shows the matching panel only
- only one tab is selected at a time
- the avatar link in the header opens the profile

**group**
- shows the host and join sections
- the code box offers a 6-digit placeholder
- letters in the code box fail the 6-digit pattern
- the code box does not take more than 6 digits
- joining with an unknown code does not leave the page

**stop page**
- renders a stop and its nearby places from the mock API
- shows the stop name
- calls the places and arrivals APIs for that stop
- does not write anything to the database just by viewing

**safety**
- browsing every member page makes no database writes
- no member page throws an uncaught error

## app/spin.spec.ts

**home / spin page**
- shows the heading and filter panel
- Spin is disabled and a hint is shown until a start is picked
- typing a place shows matching suggestions
- picking a suggestion enables Spin and shows the starting line
- arrow keys and Enter pick a suggestion
- Escape closes the suggestion list
- category chips toggle on and off
- all six category chips are offered
- the time slider reacts to the keyboard and stays in range
- ?mins= and ?cats= in the URL preset the filters
- changing the filters updates the URL
- unknown categories in the URL are ignored
- before spinning, the results area explains what to do

**spinning**
- a spin shows mystery tickets
- the button becomes "Spin again" after a spin
- a far-away start says no stops were found
- preferences nothing matches show the preferences error
- Try again in the error box spins again

**spinning with the API failing**
- the page still renders and does not crash

**home on a phone**
- filters live in a bottom sheet opened by a button

## public/auth-guards.spec.ts

**logged out visitors**
- ${route} sends a visitor back to the landing page
- login and register pages stay open

**logged in visitors (fake session)**
- login redirects to /home
- register redirects to /home
- ${route} opens
- header shows member links instead of Log in / Register
- profile avatar link is shown
- Log out returns to the landing page
- header links navigate between member pages

## public/forms.spec.ts

**login form**
- shows email, password and a submit button
- password field hides what you type
- link to register works
- empty submit stays on the page (browser validation)
- wrong credentials show an error
- typing in the fields keeps their values

**register form**
- shows name, email, password and confirm fields
- link back to login works
- mismatched passwords do not create an account
- a valid form shows the success state with a Log in button
- short password (under 8) is not accepted

## public/landing.spec.ts

**landing page (logged out)**
- loads with the right title and headline
- page is in English (Singapore)
- header shows Log in and Register, not the member links
- hero "Start a side quest" goes to register
- hero "Log in" goes to login
- "How it works" link points at the steps section
- has the how-a-side-quest-works section and the bottom call to action
- brand link in the header returns to the landing page
- has no uncaught page errors on load
- footer is rendered
- unknown route does not crash the app shell

**landing page (mobile)**
- menu button toggles the navigation
- page does not scroll sideways

## unit/chooseAndAmens.spec.ts

**chooseStop**
- throws when there are no stops
- returns the only stop when there is one
- always picks one of the candidates
- can pick different stops over many tries

**filterByAmens**
- no preferences returns every stop unchanged
- keeps only stops that have a preferred category
- several preferences match any of them
- stops without amenity data are dropped
- keeps the original stop details
- throws a helpful error when nothing matches

## unit/filterStops.spec.ts

**filterStartingBusStops**
- only includes stops within walking range
- walking time is a small positive number of minutes
- returns nothing when the start is far from every stop
- walking range is capped by a 10 minute walk even with long travel time
- a very short travel time shrinks the walking range
- empty bus stop list gives an empty result

**filterBusStops**
- seeds each starting stop with no bus
- adds stops reachable along the route within the time limit
- excludes a stop whose total time goes over the limit
- records bus, boarding stop, stop count and time
- a shorter travel time reaches fewer stops
- no arrivals means nothing beyond the starting stop
- stops are never counted from a different bus direction

## unit/utils.spec.ts

**geo**
- distance between the same point is 0
- is symmetric
- 0.01 degrees of latitude is roughly 1.1 km
- Bugis to Orchard is a few kilometres
- walkMinutes is at least 1
- walkMinutes grows with distance (1.3 detour at 80 m/min)

**category tables**
- the six spin categories exist
- every spin category has a label and icon
- categoryInfo falls back for unknown categories
- every spin category maps to existing place sub-filters
- every place sub-filter belongs to a known section with tags
- every tag looks like key=value

**userColor**
- is stable for the same name
- always returns a hex colour, even for empty input
- different names can get different colours

**LED font**
- empty text has zero width
- width is 6 columns per letter minus the last gap
- dots stay inside the text bounds
- a space lights no dots, a letter lights some
- is case-insensitive
- scale multiplies dot count by scale squared
- unknown characters are treated as spaces
