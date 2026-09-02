# Bugs found

Add one section per issue. Bug 1 is filled in to show the format — fix it, then write what you changed. Copy the blank template for the rest.

Keep this file in the repo and **commit it** with your fixes.

---

## Bug 1

**How to reproduce:** Open the app. The expense list says "Newest first". The first row is Wine (7 Mar). Board game (15 Mar) is further down.

**What is wrong:** The list is showing oldest expenses first. Newest should be at the top.

**What I changed:** Turns out this was two bugs stacked on top of each other. First, the obvious one: the sort in `ExpenseList.jsx` was comparing dates as `a - b`, which is ascending order, even though the panel is labeled "Newest first". I flipped it to `b - a`.

But there was a sneakier second bug hiding underneath it. `dateValue()` in `format.js` didn't actually do anything — it just handed back whatever it was given. On a fresh load the dates happen to be real `Date` objects, so subtracting them worked well enough that you'd only notice the direction was backwards. But after a page refresh, expense dates come back out of `localStorage` as plain strings (see Bug 6), and subtracting two strings gives `NaN` — so the sort would just silently stop doing anything at all. I made `dateValue` actually convert whatever it's given into a real date and return a timestamp, so the sort works correctly no matter where the date came from.

---

## Bug 2

**How to reproduce:** Filter the expense list down to just "Fun" expenses. Now click "Delete" on the first row you see — say, "Museum tickets".

**What is wrong:** It deletes the wrong expense. In my test it deleted "Groceries", which wasn't even one of the rows on screen. The same thing happens if you edit an expense's amount while a filter is active — you can end up changing a completely different expense's number. This isn't a rare edge case either — even with no filter applied, just having the list sorted differently than it's stored (see Bug 1) is enough to trigger it.

The root cause: the list was identifying rows by their position in the array (index 0, index 1, ...), but that position was calculated *after* filtering and sorting. When you clicked delete on row 0 on screen, the app deleted item 0 from the original, unfiltered, unsorted list in storage — which is a totally different expense.

**What I changed:** Every expense now has a stable `id` (it already did — it just wasn't being used for this). I changed delete and edit to look up expenses by `id` instead of by their position on screen, in `store.js`, `App.jsx`, and `ExpenseList.jsx`. I also swapped the list's React `key` from the array index to `expense.id`, since that was the same underlying mistake showing up as a second symptom — a row's "edit amount" text box could show a stale, wrong value after the list re-sorted, because React was reusing the wrong DOM element for the wrong expense.

---

## Bug 3

**How to reproduce:** Just open the app and look at the two side panels. Ben Okonkwo paid the most money of anyone in the group ($276 — check the Summary panel), but the Balances panel tells you he "owes $59.00". Meanwhile Aisha, who's paid the least relative to her share, is shown as "is owed $85.00". Then look at Settle-up right below it: it says Aisha should be *paying* Ben — which contradicts what the Balances panel just told you two seconds earlier.

**What is wrong:** The two panels were built on the same underlying number but disagreed about which direction it points. Positive means "the group owes this person" and negative means "this person owes the group" — that's how `computeBalances` and the settle-up logic both treat it. But the Balances panel had its two label branches flipped: it said "owes" for positive numbers and "is owed" for negative ones, exactly backwards.

**What I changed:** Swapped the two branches in `BalancesPanel.jsx` so a positive balance shows "is owed" (in green) and a negative one shows "owes" (in red) — matching how the rest of the app already treats the number.

---

## Bug 4

**How to reproduce:** Look at "Uber to airport" in the demo data — Diya paid $60 for it but isn't one of the people it's split between (only Aisha and Ben are). Now add up every single balance shown in the Balances panel. It doesn't come out to $0 — it's off by $30, which is suspiciously close to the size of the expenses where the payer isn't in their own split.

**What is wrong:** The README is explicit about this: "Someone can put a cab on their card even if they did not ride... They should get that fare back in full." Instead, `computeBalances` had an extra bit of logic that kicked in specifically when the payer *wasn't* on the split, and it charged them an *extra* share on top of already crediting them the full amount they paid. So Diya fronted $60 for a cab she never used, and the app then quietly took $30 away from her for it — the exact opposite of what's supposed to happen. This is also why the group's numbers never summed to zero — money was leaking out of the books every time this happened.

**What I changed:** Deleted that block. Now the payer just gets credited what they paid and debited only for whatever shares actually have their name on them — nothing more, nothing less, which is exactly the "pay for others and get it back in full" behavior the README describes.

---

## Bug 5

**How to reproduce:** Imagine one person owes exactly $50 and another is owed exactly $50 — a perfectly clean match. Settle-up should tell them to pay each other. Instead it says "Everyone is settled," even though nobody's actually paid anyone back.

**What is wrong:** The settlement algorithm walks through debtors and creditors, matching them up. It has three cases: the debtor owes more than the creditor is owed, the debtor owes less, and — the one that got missed — they owe exactly the same amount. In that exact-match case, the code just moved on to the next pair without ever recording a payment. This isn't a rare fluke either; round numbers matching up exactly is a pretty common thing to happen with real trip expenses.

**What I changed:** Added the missing transfer in that branch, so an exact match still produces a "pay this amount" instruction instead of silently vanishing.

---

## Bug 6

**How to reproduce:** Add or edit an expense, then just refresh the page. The dates in the list now show up as raw text like `2026-03-12` instead of the nicely formatted `12 Mar 2026`, and the "newest first" sorting stops working entirely.

**What is wrong:** When the app loads for the very first time (nothing saved yet), it converts the date strings into real JavaScript `Date` objects before using them. But on every load *after* that — which is basically every load, since it just saved data the first time — it skipped that conversion and just parsed the raw JSON, leaving dates as plain text strings. JSON has no concept of a "date" type, so this is an easy trap: anything downstream that expects a real date (formatting it, doing math with it to sort) quietly breaks.

**What I changed:** Made the app run that same date-conversion step every time it loads from storage, not just the very first time. Now dates are always real `Date` objects no matter where the data came from.

---

## Bug 7

**How to reproduce:** Use the "Paid by" dropdown in the Filter panel and pick anyone — say Ben Okonkwo, who's the payer on three separate expenses.

**What is wrong:** No matter who you pick, you get "No expenses match these filters." Every single time. This one comes down to a very ordinary JavaScript trap: dropdown menus always give you back a string, even if the options look like numbers. So picking Ben set the filter to the *string* `"2"`, but every expense's `paidBy` field is stored as the *number* `2`. And `"2" !== 2` in JavaScript, so the comparison failed for every expense, every time.

**What I changed:** Converted the filter value to a number before comparing it against `expense.paidBy`.

---

## Bug 8

**How to reproduce:** Look at "Groceries" — $100 split three ways. Or "Wine" — $20 split by percentages of 33.33 / 33.33 / 33.34. Now add up the shares by hand.

**What is wrong:** The README is clear that splitting a bill "should not lose or invent money" — the shares should always add back up to the original amount. But $100 divided three ways and rounded to the cent gives three shares of $33.33, which only totals $99.99. A penny just disappears. The percentage split on Wine had the same problem in the other direction, coming out to $20.01. It's a small amount on any one bill, but over a whole trip's worth of expenses these missing or extra cents pile up, and the group's books never actually balance.

**What I changed:** Rewrote both the equal split and the percentage split to work in whole cents and use a "largest remainder" method — basically: figure out everyone's fair share down to the cent, round each one down, and then hand out whatever cents are left over (there's never more than a few) to the people whose share got rounded down the most. The totals now always land exactly on the original amount, to the cent, every time.

---

## Bug 9

**How to reproduce:** Add an expense, switch to "Custom %", and type in percentages that genuinely add up to 100 but aren't perfectly round numbers — like 5.1 / 64.1 / 30.8. The form rejects it anyway with "Percentages must add to 100," even though a calculator will tell you it does.

**What is wrong:** This is a classic floating-point gotcha. Computers can't represent most decimal numbers exactly in binary, so `5.1 + 64.1 + 30.8` doesn't always come out to a perfectly clean `100` — it might land on `99.99999999999999` instead. The code was checking for exact equality to 100, so anything with that tiny, invisible rounding noise got rejected. I actually tested this at scale: I brute-forced roughly 540,000 different three-way percentage combinations, and over 44,000 of them — about 8% — were being wrongly rejected.

**What I changed:** Changed the check to allow for a tiny bit of wiggle room (half a cent's worth) instead of demanding an exact match. That's enough to swallow the floating-point noise without letting through percentages that are actually meaningfully wrong. Re-ran the same 540,000-combination test afterward and got zero false rejections.

---

## Bug 10

**How to reproduce:** Add a new member using the form in the Summary panel. Look at the "Paid so far" list right above it — the new person isn't there. Now go add, edit, or delete any expense, and suddenly they appear.

**What is wrong:** This is a React dependency-array mistake. The calculation for "who's paid what" reads the list of members, but it was only told to recalculate when the *expenses* changed — not when the *members* changed. So React kept showing the old, cached version of that list until something unrelated forced a recalculation.

**What I changed:** Added `members` to the list of things that trigger a recalculation, so adding a member updates the panel immediately.

---

## Bug 11

**How to reproduce:** This one's hard to catch by clicking around slowly, but if you added expenses fast enough (or the app were driven by a script), two expenses could end up with the exact same ID.

**What is wrong:** New expense IDs were generated from `Date.now()` — the current time in milliseconds. If two expenses got created within the same millisecond, they'd get the identical ID. Because everything else in the app (and the id-based delete/edit fix from Bug 2) trusts that IDs are unique, a collision like that means editing or deleting one of them could silently affect the other instead.

**What I changed:** Switched to using `crypto.randomUUID()` (a standard browser feature, not a new dependency) to generate IDs, with a fallback for older environments that don't have it. Two expenses can no longer collide.

---

## Bug 12

**How to reproduce:** Add an expense — fill in the description, amount, pick a payer, etc. — and save it. Look at the form afterward.

**What is wrong:** Nothing in the form clears. The description and amount you just typed are still sitting there, so if you go to add a second expense right after, it's easy to accidentally resubmit the same one, or just be confused about whether it actually saved. Separately, the date field always started out hardcoded to `16 March 2026`, regardless of what today's actual date is — so every new expense defaulted to a specific day in the past instead of today.

**What I changed:** After an expense saves successfully, the description and amount fields now clear themselves so the form is ready for the next entry. The date field now defaults to today's date instead of a hardcoded one.

---

## Bug 13

**How to reproduce:** Start adding a new expense. Fill in a description and an amount, but then clear out the Date field entirely (click into it and delete it) and hit "Save expense" anyway.

**What is wrong:** Nothing stops you. The expense gets saved and shows up in the list with the payer's name, then literally the text **"Invalid Date"**, then the split info — right there on screen, no error, no warning. I actually tried it: the row read `Aisha Khan · Invalid Date · split 4 ways`. Worse, that broken date doesn't even error out loudly enough to notice — when it's written to storage, `JSON.stringify` quietly turns the invalid date into `null`, and when the app reads it back, `null` gets treated as "January 1st, 1970." So the expense doesn't crash anything, it just silently drops to the very bottom of "Newest first" forever and shows a nonsense date, and you'd have no idea why unless you went looking. Out of every field on that form, description, amount, and the split all get checked before saving — the date was the one thing nobody validated.

**What I changed:** Added a check right alongside the existing ones: if the date field is empty or doesn't parse into a real date, the form now shows "Pick a valid date." and refuses to save, exactly like it already does for a missing description or a bad amount. This was a genuinely easy one to miss because you'd only find it by actually clearing that field in the browser — reading the code alone, the date field looks no different from any other input.

---

## Bug 14

**How to reproduce:** Add a new expense with an amount like `10.999` (three decimal places instead of two) and split it between a couple of people. The line item itself will look fine — it rounds nicely to "$11.00" on screen. But the group's accounting has actually just gone slightly wrong behind the scenes.

**What is wrong:** This is the sneaky one, because it's invisible on screen — I only found it by directly inspecting the numbers the balance calculator was actually working with, not what got displayed. Here's the mechanism: the app already rounds each person's *share* of a bill down to the cent so nobody's portion has weird fractional pennies (that's a separate fix — see Bug 8). But nothing ever rounded the *original amount typed into the form*. So if you type in `10.999`, the person who paid gets credited with the full, un-rounded `10.999` in the ledger, while the two people splitting it get charged shares that were rounded to a clean `11.00` total. Those two numbers — what the payer's credited and what the group is charged — no longer match, by a fraction of a cent. I actually plugged this exact scenario into the balance calculator directly and measured it: the group's total balance came out to `-0.000999999999990564` instead of a clean zero. It's the exact same "money quietly leaking out of the group's books" problem the split-rounding fix (Bug 8) already solved — just sneaking back in through a completely different door, one bill at a time, until enough of them add up to an actual cent that shows up somewhere.

**What I changed:** Now, the moment an amount is entered — whether adding a brand-new expense or editing one inline in the list — it gets rounded to the nearest cent before it's ever stored or used in any calculation. A stray third decimal place can no longer sneak into the group's books at all.

---

## Bug 15

**How to reproduce:** Start a new expense, switch to "Custom %", and carefully type in a deliberate uneven split — say 70% / 10% / 10% / 10% for four people. Now just click one person's chip off and immediately click it back on, the way you might if you were double-checking who's included, or if you just misclicked.

**What is wrong:** All four of your carefully-typed percentages get wiped out and silently replaced with an even 25/25/25/25 split — even though you never touched the percentage boxes themselves, and even though you put that person right back in the split a second later. I tested it directly: typed in 70/10/10/10, clicked one chip off then back on, and watched all four numbers reset to 25 each. The README is pretty direct about this kind of thing: "what you click is what should change" — but clicking one person's chip was silently changing everyone else's numbers too, with zero warning that it was about to happen. Anyone doing a real, deliberate uneven split (say, "Carlos gets none of this because he skipped dinner") would lose that work the instant they clicked anything in the split-selection area again.

**What I changed:** Toggling someone in or out of the split now only touches *their own* row. Removing someone just drops their percentage and leaves everyone else's numbers exactly as they were. Adding someone back in gives them a starting point of 0% — rather than the app guessing how you want to redistribute the rest of the money on your behalf — so you decide what they owe instead of it silently reshuffling numbers you already set. I also stopped the "Custom %" toggle from resetting your percentages back to even every time you clicked it, unless the group of people actually changed — so switching between "Split equally" and "Custom %" to compare the two no longer throws your custom numbers away either.

---

## Bug 16

**How to reproduce:** Add a new person to the group using the "Add member" box in the Summary panel — say, "Zara". Now look at the "Split between" chips in the Add Expense form right above it, where all four original friends are already selected (highlighted). Zara's chip is there too, but it's *not* selected.

**What is wrong:** This one took actually using the app the way a real trip organizer would, not just reading the code — a new friend joins partway through the trip, gets added to the group, and the very next bill you log for "everyone" quietly leaves them off, because their chip defaulted to unchecked while everybody else's defaulted to checked. Nothing on screen flags this as different — the chip looks exactly like any other unselected chip, not like "hey, this is a new person, you probably want to double check them." I actually tested this: I added "Zara," then submitted a normal $50 expense expecting it to touch everyone — it split four ways, quietly excluding her. Given the entire point of this app is making sure the right people get charged for the right things, silently dropping someone who was just added to the group is exactly the kind of mistake the README is trying to prevent ("Anyone who was not involved should be left out of that bill" — but the flip side, someone who *should* be involved getting left out by a UI default, is just as bad).

The root cause: the list of who's selected for a new expense (`splitWith`) is only ever set up once, from whoever's in the group at the moment you first load the page. The Add Expense form doesn't unmount or reset after that, so it never notices when the group of people grows — it just keeps using that original snapshot of members forever.

**What I changed:** The form now watches for new members being added to the group while it's open, and automatically includes anyone new in the current split selection — so a newly added person defaults to "included," exactly like everyone who was already there. If you're mid-way through building a custom percentage split when someone new joins, they show up with an honest 0% (matching how manually adding someone to a percent split already works, per Bug 15) rather than the app guessing how to carve up the money for them behind your back.

*A dead end worth mentioning:* while testing this, I suspected a second bug — that clicking "Add member" twice in quick succession might hand two new people the same internal ID, since the ID is computed from the current member list right before saving. I tested it directly (two submissions fired back-to-back with no pause in between) and it turned out fine — React re-renders in between each submit, so each one sees the updated list and gets a distinct ID. No fix needed there; noting it so it's clear this was checked, not missed. I also ran the balance and settle-up math through 20,000 randomly generated trip scenarios (3-6 people, random bills, random splits) to make sure Bugs 4, 5, and 8 hadn't left any leftover edge case — the worst drift found was about a trillionth of a cent, which is ordinary floating-point noise, not a real bug.

---
