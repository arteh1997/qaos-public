export interface GuideTip {
  title: string
  description: string
}

export interface PageGuideContent {
  title: string
  overview: string
  tips: GuideTip[]
  proTip?: string
}

export type PageKey =
  | 'dashboard'
  | 'inventory'
  | 'stock-count'
  | 'low-stock'
  | 'inventory-value'
  | 'waste'
  | 'recipes'
  | 'suppliers'
  | 'deliveries'
  | 'shifts'
  | 'shift-timetable'
  | 'my-shifts'
  | 'users'
  | 'reports'
  | 'daily-summary'
  | 'low-stock-report'
  | 'ai-forecast'
  | 'benchmark'
  | 'food-cost'
  | 'activity'
  | 'settings'
  | 'billing'
  | 'pos'
  | 'haccp'
  | 'haccp-checks'
  | 'haccp-temperatures'
  | 'haccp-templates'
  | 'haccp-corrective-actions'
  | 'payroll'
  | 'my-pay'
  | 'invoices'
  | 'integrations'
  | 'categories'
  | 'tags'

export const PAGE_GUIDES: Record<PageKey, PageGuideContent> = {
  dashboard: {
    title: 'Dashboard Guide',
    overview: 'Your command centre — live inventory health, alerts, and daily checklists all in one view.',
    tips: [
      {
        title: 'Check your health score daily',
        description: 'The inventory health score summarises how well-stocked you are relative to your PAR levels. Aim to keep it above 80%.',
      },
      {
        title: 'Act on low-stock alerts immediately',
        description: 'Red items are below their minimum PAR level. Tap any alert to jump directly to that item and create a reorder.',
      },
      {
        title: 'Use the activity feed to spot patterns',
        description: 'The recent activity list shows who changed what and when. Use it to identify if counts are being skipped or staff are logging unusual adjustments.',
      },
      {
        title: 'Switch stores from the sidebar',
        description: 'If you manage multiple locations, use the store selector at the top of the sidebar to flip between them.',
      },
    ],
    proTip: 'Bookmark the dashboard — it gives you a full health summary in under 5 seconds.',
  },

  inventory: {
    title: 'Inventory Guide',
    overview: 'Add and manage all the items you track — ingredients, supplies, and anything with a stock level.',
    tips: [
      {
        title: 'Set PAR levels for everything',
        description: 'PAR (Periodic Automatic Replenishment) is the minimum quantity you should always have. Items without a PAR level won\'t trigger low-stock alerts.',
      },
      {
        title: 'Edit inline — no form needed',
        description: 'Click any Stock, PAR, or Unit Cost value directly in the table to edit it. Changes save together when you click "Save All".',
      },
      {
        title: 'Import in bulk via CSV',
        description: 'Use the More Actions menu to import a CSV file. Download the template first so your column headers match exactly.',
      },
      {
        title: 'Categorise items for faster filtering',
        description: 'Assign a category to each item (e.g. Dairy, Produce, Dry Goods). The category filter narrows the list when you have hundreds of items.',
      },
      {
        title: 'Unit costs drive your financial reports',
        description: 'Set a unit cost on every item. Without costs, Inventory Value and Food Cost reports will be incomplete.',
      },
    ],
    proTip: 'Use the CSV export regularly to back up your inventory list. It\'s also useful for sharing with your accountant.',
  },

  'stock-count': {
    title: 'Stock Count Guide',
    overview: 'Record the actual quantity of every item on your shelves. Daily counts keep your stock data accurate.',
    tips: [
      {
        title: 'Count every item before service starts',
        description: 'Counting at the same time each day (e.g. 7am before prep) gives you consistent, comparable data.',
      },
      {
        title: 'Submit even if nothing changed',
        description: 'Submitting a count with the same quantities still creates a record. The Daily Summary report needs at least one count per day.',
      },
      {
        title: 'Use the form on mobile',
        description: 'The stock count form is optimised for mobile — walk around your kitchen with your phone and tap each quantity as you count.',
      },
      {
        title: 'The green banner means today\'s count is done',
        description: 'Once submitted, a green "Count Complete" banner appears. You can re-submit if you made an error — the latest count wins.',
      },
    ],
    proTip: 'Enable the "Missing Counts" alert in Settings > Alerts so you get an email if no count has been submitted by a set time each day.',
  },

  'low-stock': {
    title: 'Low Stock Guide',
    overview: 'A live view of every item currently below its PAR level, ranked by severity.',
    tips: [
      {
        title: 'Sort by shortfall to prioritise',
        description: 'Items furthest below PAR are at the top. Address these first — they\'re most likely to cause a stockout during service.',
      },
      {
        title: 'Tap an item to raise a purchase order',
        description: 'From the low-stock list, you can jump directly to Suppliers to raise a purchase order for the affected items.',
      },
      {
        title: 'Zero-stock items are critical',
        description: 'Items showing 0 in stock are a service risk right now. A PAR level of even 1 is enough to make these appear here.',
      },
    ],
    proTip: 'Set up email alerts in Settings > Alerts to receive a daily low-stock digest before you arrive at the store.',
  },

  'inventory-value': {
    title: 'Inventory Value Guide',
    overview: 'The total monetary value of everything you currently hold in stock, broken down by category.',
    tips: [
      {
        title: 'Value is only as accurate as your costs',
        description: 'Inventory value = quantity × unit cost. Items without a unit cost are excluded from the total. Go to Inventory to fill in missing costs.',
      },
      {
        title: 'Use category breakdown to spot imbalances',
        description: 'If one category dominates your total value, you may be over-ordering. Compare against your sales data.',
      },
      {
        title: 'Take a snapshot before stocktake',
        description: 'Print this page before your monthly stocktake as a reference for your accountant.',
      },
    ],
    proTip: 'Run an inventory count immediately before viewing this page for the most accurate value figure.',
  },

  waste: {
    title: 'Waste Tracking Guide',
    overview: 'Log and monitor food waste to understand where losses are occurring and reduce costs over time.',
    tips: [
      {
        title: 'Log waste the moment it happens',
        description: 'Waste logged immediately is more accurate than end-of-day estimates. Encourage staff to log directly on mobile.',
      },
      {
        title: 'Choose the right reason category',
        description: 'The reason (Spoilage, Expired, Damaged, Overproduction) drives the analytics breakdown. Consistent tagging helps fix the root cause.',
      },
      {
        title: 'Watch the "Top Wasted Items" card',
        description: 'The top items table reveals which ingredients cost you the most in waste. Focus ordering and storage improvements there.',
      },
      {
        title: 'Overproduction points to recipe issues',
        description: 'If a specific ingredient keeps appearing under Overproduction, review whether your recipe quantities or batch size needs adjusting.',
      },
    ],
    proTip: 'Compare your total waste cost as a percentage of inventory value week-over-week. A rising percentage means waste is growing faster than your stock.',
  },

  recipes: {
    title: 'Recipes & Menu Guide',
    overview: 'Build recipes from your inventory items to calculate food costs and analyse menu profitability.',
    tips: [
      {
        title: 'Every ingredient needs a unit cost first',
        description: 'Recipe costs come from inventory unit costs. Set costs in Inventory before building recipes, or your food cost figures will be zero.',
      },
      {
        title: 'Add menu items with a selling price',
        description: 'Once a recipe has a cost, create a menu item with a selling price to see your gross profit margin and food cost percentage.',
      },
      {
        title: 'Use the Menu Analysis tab',
        description: 'The analysis view ranks your menu items by profitability and popularity. Use it to decide which items to promote, reprice, or remove.',
      },
      {
        title: 'Recipe costs update automatically',
        description: 'If you renegotiate a supplier price and update the unit cost in Inventory, all recipes using that ingredient recalculate automatically.',
      },
    ],
    proTip: 'Target a food cost percentage of 28–35% for most restaurant operations. Anything above 40% on a dish suggests over-portioning or under-pricing.',
  },

  suppliers: {
    title: 'Suppliers & Orders Guide',
    overview: 'Manage your supplier directory and track purchase orders from creation through to delivery.',
    tips: [
      {
        title: 'Add all suppliers before creating orders',
        description: 'Each purchase order must be linked to a supplier. Set up your supplier directory first with contact details and payment terms.',
      },
      {
        title: 'Use "Quick Order" from the supplier row',
        description: 'Click the Order button on any supplier to pre-fill a purchase order with that supplier already selected.',
      },
      {
        title: 'Record partial deliveries',
        description: 'If a delivery arrives with missing items, click "Receive Delivery" and enter only the quantities actually received. The PO stays open for the remainder.',
      },
      {
        title: 'Receiving a delivery updates stock automatically',
        description: 'When you confirm receipt, the received quantities are added directly to your inventory. No separate stock count needed.',
      },
    ],
    proTip: 'Set up the Supplier Portal to let your supplier log in and confirm order receipt or update delivery dates themselves.',
  },

  deliveries: {
    title: 'Deliveries Guide',
    overview: 'A focused view of purchase orders that are in transit or awaiting confirmation of receipt.',
    tips: [
      {
        title: 'Click any delivery to see its line items',
        description: 'Tap a delivery row to expand the full order and check which items and quantities you\'re expecting.',
      },
      {
        title: 'Check expected delivery dates regularly',
        description: 'Overdue deliveries appear highlighted. Chase your supplier if a delivery is 24+ hours late to avoid stockouts.',
      },
      {
        title: 'Record receipt as soon as goods arrive',
        description: 'Recording receipt immediately keeps your live inventory count accurate. Don\'t wait until end of shift.',
      },
    ],
    proTip: 'Cross-reference your delivery against the original PO line items before signing the delivery note. Record discrepancies in the notes field.',
  },

  shifts: {
    title: 'Shifts Guide',
    overview: 'Schedule your team\'s working hours and monitor attendance and clock-in status in real time.',
    tips: [
      {
        title: 'Use week navigation to plan ahead',
        description: 'Use the arrow buttons or date picker to navigate to future weeks and schedule shifts before the week starts.',
      },
      {
        title: 'Active shifts show in real time',
        description: 'The "Active Now" card shows who is currently on shift with a live progress bar and time remaining.',
      },
      {
        title: 'Edit clock times to correct errors',
        description: 'If a staff member forgot to clock in or out, use the three-dot menu > "Edit Clock Times" to manually set their actual times.',
      },
      {
        title: 'Attendance rate tracks punctuality',
        description: 'The attendance percentage shows what portion of past shifts were clocked in. Below 80% should prompt a conversation.',
      },
    ],
    proTip: 'Switch to Timetable View to see your whole team\'s schedule in a weekly grid — easier for spotting gaps or double-bookings.',
  },

  'shift-timetable': {
    title: 'Shift Timetable Guide',
    overview: 'A visual calendar showing your full team schedule in a time-grid layout.',
    tips: [
      {
        title: 'Scroll horizontally to see all staff',
        description: 'Each column represents one team member. Scroll right to see all staff if you have a large team.',
      },
      {
        title: 'Overlap detection',
        description: 'If two shifts for the same person overlap, they appear stacked. Review these carefully — they may indicate a scheduling error.',
      },
      {
        title: 'Navigate by week using the date picker',
        description: 'Use the date picker at the top to jump to any specific week for checking past or future schedules.',
      },
    ],
    proTip: 'Print the timetable view for a physical copy to post in the staff area.',
  },

  'my-shifts': {
    title: 'My Shifts Guide',
    overview: 'Your personal schedule — all shifts assigned to you, past and upcoming.',
    tips: [
      {
        title: 'Clock in and out from this page',
        description: 'When you arrive for a shift, use the Clock In button. Clock out when your shift ends. This is required for payroll calculation.',
      },
      {
        title: 'Check upcoming shifts to plan your week',
        description: 'Navigate forward using the date picker to see what shifts you\'re scheduled for in the coming days.',
      },
      {
        title: 'Contact your manager if a shift is wrong',
        description: 'If you see a shift with incorrect hours, contact your Owner or Manager — only they can edit or delete shifts.',
      },
    ],
    proTip: 'Clock in as early as you arrive — the system records the actual time, not the scheduled time.',
  },

  users: {
    title: 'Users Guide',
    overview: 'Invite team members, manage roles, and control who has access to your store.',
    tips: [
      {
        title: 'Understand the three roles',
        description: 'Owner has full access including billing. Manager can do everything except billing. Staff can count stock, log waste, and manage their own shifts.',
      },
      {
        title: 'Invite via email',
        description: 'Click "Invite User" and enter their email. They\'ll receive an invitation link and must sign up with that same email address.',
      },
      {
        title: 'Resend or cancel pending invites',
        description: 'If someone hasn\'t accepted their invite, find them in the Pending Invites tab. You can resend the email or cancel the invite.',
      },
      {
        title: 'Remove users carefully',
        description: 'Removing a user revokes their access immediately. Any shifts they are scheduled for will remain — reassign those manually.',
      },
    ],
    proTip: 'A user can belong to multiple stores with different roles. Invite them to each store separately.',
  },

  reports: {
    title: 'Reports Guide',
    overview: 'Analytics and exports covering stock movements, financial performance, demand forecasting, and benchmarking.',
    tips: [
      {
        title: 'Start with the AI Forecast',
        description: 'The AI Demand Forecast shows which items are most likely to run out and when, based on your actual consumption history.',
      },
      {
        title: 'Daily Summary for audit trails',
        description: 'The Stock Summary shows every count, reception, and adjustment in chronological order. Use it when investigating discrepancies.',
      },
      {
        title: 'Low Stock Report for reordering',
        description: 'Export the Low Stock report to CSV and send it directly to your suppliers as an order list.',
      },
      {
        title: 'Benchmark compares your stores',
        description: 'If you have multiple stores, the Benchmark report ranks them side-by-side on health score, waste, and activity.',
      },
    ],
    proTip: 'Run the Food Cost analysis monthly and compare it to your actual P&L. A growing gap usually means increasing waste or portioning issues.',
  },

  'daily-summary': {
    title: 'Stock Summary Guide',
    overview: 'A complete, date-filtered log of every stock movement — counts, receptions, adjustments, waste, and sales.',
    tips: [
      {
        title: 'Filter by date range to narrow scope',
        description: 'Use the date picker to look at a specific day, week, or custom range. A single day view is useful for reconciling end-of-day variances.',
      },
      {
        title: 'Export to CSV for accounting',
        description: 'The CSV export includes all movement types and timestamps. Your accountant can use this for COGS calculations.',
      },
      {
        title: 'Action type column tells you the source',
        description: 'Count = manual stock count, Reception = delivery received, Adjustment = manual edit, Waste = logged waste, Sale = POS deduction.',
      },
    ],
    proTip: 'Use the print view for physical stocktake reconciliation. The formatted layout fits neatly on A4 paper.',
  },

  'low-stock-report': {
    title: 'Low Stock Report Guide',
    overview: 'A snapshot of all items currently below their PAR level, ready to export as a reorder list.',
    tips: [
      {
        title: 'Export as a reorder list',
        description: 'Download as CSV and share with suppliers. The shortfall column shows exactly how many units you need to reach PAR.',
      },
      {
        title: 'Items without PAR levels won\'t appear',
        description: 'If an item isn\'t showing up even though it\'s low, check if a PAR level has been set on it in Inventory.',
      },
    ],
    proTip: 'Schedule a Monday morning review of this report to create your weekly purchase orders before the busy period begins.',
  },

  'ai-forecast': {
    title: 'AI Forecast Guide',
    overview: 'Machine learning predictions for each item\'s future consumption, stockout risk, and suggested order quantities.',
    tips: [
      {
        title: 'The forecast needs history to work',
        description: 'Predictions are based on your stock count and sales history. Items with fewer than 7 days of data will show low confidence.',
      },
      {
        title: 'Risk levels guide urgency',
        description: 'Critical = likely to stock out within 3 days. High = within a week. Medium = within 2 weeks. Low = well stocked.',
      },
      {
        title: 'Click an item to see the detailed chart',
        description: 'Each item card expands to show a visual projection of stock over the forecast period, including the predicted stockout date.',
      },
      {
        title: 'Adjust the history window',
        description: 'Longer windows smooth out anomalies; shorter windows react faster to trend changes.',
      },
    ],
    proTip: 'The weekday pattern chart shows which days drive the most consumption. Use this to time your deliveries — order to arrive the day before your busiest day.',
  },

  benchmark: {
    title: 'Store Benchmarking Guide',
    overview: 'Side-by-side comparison of all your stores on key performance indicators.',
    tips: [
      {
        title: 'Health score is your primary KPI',
        description: 'The health score reflects how well each store is tracking against PAR levels. The highest-scoring store is your operational benchmark.',
      },
      {
        title: 'Look at activity count, not just score',
        description: 'A store with few log entries might look healthy simply because nothing is being counted. High activity means the team is engaged.',
      },
      {
        title: 'Share results with your managers',
        description: 'Friendly competition between store managers — driven by visible benchmarking — often improves compliance significantly.',
      },
    ],
    proTip: 'You need at least 2 stores before this report is meaningful. Single-store operations should focus on AI Forecast and Daily Summary instead.',
  },

  'food-cost': {
    title: 'Food Cost Analysis Guide',
    overview: 'Compares theoretical food cost (what recipes should cost) against actual inventory consumption.',
    tips: [
      {
        title: 'Requires both POS integration and recipes',
        description: 'This report needs POS sales data and recipe definitions with ingredient costs. Set these up first.',
      },
      {
        title: 'Variance percentage is the key number',
        description: 'A variance above 5–8% indicates a meaningful gap between what you should be using and what\'s actually being consumed.',
      },
      {
        title: 'High variance can mean multiple things',
        description: 'Common causes: over-portioning, unrecorded waste, theft, free meals, or incorrect recipe quantities.',
      },
    ],
    proTip: 'Run this report weekly rather than monthly. Catching a portioning problem in week 1 saves you from three additional weeks of loss.',
  },

  activity: {
    title: 'Activity Log Guide',
    overview: 'A complete, searchable audit trail of every action taken in your store.',
    tips: [
      {
        title: 'Click any row to expand full details',
        description: 'Each entry expands to show the specific data that changed — quantities before and after, items affected, user who made the change.',
      },
      {
        title: 'Filter by category to focus',
        description: 'Use the category dropdown to show only Inventory, Team, Suppliers, or System events.',
      },
      {
        title: 'Use date range to investigate incidents',
        description: 'When investigating an issue, set the date range to the exact day and filter by Inventory & Stock.',
      },
      {
        title: 'All stock counts appear here',
        description: 'Every count, reception, and waste log is captured. If a count is missing from the Daily Summary, check here.',
      },
    ],
    proTip: 'Print the activity log for regulatory inspections. Some food safety authorities require documented records of stock handling.',
  },

  settings: {
    title: 'Settings Guide',
    overview: 'Configure your store details, alert preferences, and notification settings.',
    tips: [
      {
        title: 'Set your store\'s timezone correctly',
        description: 'The timezone affects when daily alerts fire and how timestamps appear in reports. Set this before enabling any scheduled alerts.',
      },
      {
        title: 'Enable the Missing Count alert',
        description: 'Under Alert Preferences, turn on "Missing daily count" and set a cutoff time. You\'ll get an email if no count has been submitted.',
      },
      {
        title: 'Configure low-stock thresholds',
        description: 'You can set a minimum number of items below PAR before the alert triggers, to avoid noise from a single item.',
      },
    ],
    proTip: 'Revisit alert settings every month. As your operation matures, you may need to tighten thresholds.',
  },

  billing: {
    title: 'Billing Guide',
    overview: 'Manage your subscription, payment methods, and billing history for all stores.',
    tips: [
      {
        title: 'Each store has its own subscription',
        description: 'If you own multiple stores, each has an independent subscription. You can have different plans per store.',
      },
      {
        title: 'Add a card before your trial ends',
        description: 'Add a payment method before your free trial expires to avoid service interruption. Your data is preserved even if the subscription lapses.',
      },
      {
        title: 'Download invoices for your accountant',
        description: 'Click any invoice in the history table to download a PDF. These are valid VAT invoices.',
      },
    ],
    proTip: 'If you need to pause for seasonal closure, cancel before the next billing date and reactivate when you reopen — your data will be waiting.',
  },

  pos: {
    title: 'POS Integration Guide',
    overview: 'Connect your point-of-sale system so every sale automatically deducts ingredients from inventory.',
    tips: [
      {
        title: 'Supported providers',
        description: 'Square, Toast, Clover, Lightspeed, and a Custom webhook option for other POS systems.',
      },
      {
        title: 'Map POS items to inventory after connecting',
        description: 'After the connection is active, map each POS menu item to the corresponding inventory ingredients and quantities consumed per sale.',
      },
      {
        title: 'Sales deductions appear in the Activity Log',
        description: 'Each sale event from your POS creates a "Sale" action in the activity log so you can verify the integration is working.',
      },
      {
        title: 'Test with a single item first',
        description: 'Map one POS item to one inventory item, make a test sale, then check the Daily Summary to confirm the deduction was applied.',
      },
    ],
    proTip: 'Quantity Per Sale is the key number. If a burger uses 200g of beef and your inventory unit is grams, set it to 200.',
  },

  haccp: {
    title: 'HACCP Compliance Guide',
    overview: 'Manage food safety checks, temperature monitoring, and corrective actions for regulatory compliance.',
    tips: [
      {
        title: 'Your compliance score drops when checks are overdue',
        description: 'The score drops when templated checks are due but not completed. Run checks before their scheduled frequency window closes.',
      },
      {
        title: 'Temperature alerts require immediate action',
        description: 'Any reading outside the safe range triggers an alert. Log a corrective action to document what you did to resolve it.',
      },
      {
        title: 'Create templates before running checks',
        description: 'Go to Templates to define what your HACCP checks involve — questions, pass/fail criteria, and completion frequency.',
      },
      {
        title: 'Corrective actions track resolution',
        description: 'Every failed check should generate a corrective action. Document the problem, the fix, and mark it resolved.',
      },
    ],
    proTip: 'Food safety inspectors can request your HACCP records at any time. This system provides a complete, timestamped digital trail.',
  },

  'haccp-checks': {
    title: 'HACCP Checks Guide',
    overview: 'Submit completed HACCP checks against your defined templates.',
    tips: [
      {
        title: 'Select the correct template first',
        description: 'Each check is linked to a template that defines the questions. Selecting the wrong template will invalidate your compliance record.',
      },
      {
        title: 'Partial passes still create a record',
        description: 'If some items pass and some fail, the check is recorded as "Partial". Failed items should be escalated to a corrective action.',
      },
      {
        title: 'Add notes for any non-standard finding',
        description: 'The notes field is your opportunity to document context. Inspectors value detailed notes that show active management.',
      },
    ],
    proTip: 'Run opening and closing checks at the same time every day. Consistency in timing demonstrates procedural discipline to inspectors.',
  },

  'haccp-temperatures': {
    title: 'Temperature Monitoring Guide',
    overview: 'Log fridge, freezer, and hot-hold temperatures to ensure compliance with food safety regulations.',
    tips: [
      {
        title: 'Safe temperature ranges',
        description: 'Fridges: below 5°C. Freezers: below -18°C. Hot hold: above 63°C. These are UK legal minimums.',
      },
      {
        title: 'Out-of-range readings appear as alerts',
        description: 'Any reading outside the configured min/max automatically creates an alert on the HACCP dashboard.',
      },
      {
        title: 'Configure ranges in Templates',
        description: 'Each temperature location has its own acceptable range. Set these in the Templates section.',
      },
    ],
    proTip: 'Log temperatures twice daily — at opening and before closing — for maximum compliance evidence.',
  },

  'haccp-templates': {
    title: 'HACCP Templates Guide',
    overview: 'Define the structure of your HACCP checks — questions, frequency, and pass/fail criteria.',
    tips: [
      {
        title: 'Create one template per check type',
        description: 'Typical templates: Opening Checks, Closing Checks, Delivery Inspection, Cleaning Schedule, Temperature Probe Calibration.',
      },
      {
        title: 'Set the correct frequency',
        description: 'Daily templates must be completed once per day. Per-Shift templates need completion at every shift. Weekly templates need once per week.',
      },
      {
        title: 'Templates can\'t be deleted if checks reference them',
        description: 'To retire a template, deactivate it instead. Historical checks referencing it will remain intact.',
      },
    ],
    proTip: 'Review your templates annually or after any food safety incident. They should reflect your current kitchen procedures.',
  },

  'haccp-corrective-actions': {
    title: 'Corrective Actions Guide',
    overview: 'Track, document, and resolve issues identified during HACCP checks or temperature monitoring.',
    tips: [
      {
        title: 'Link actions to the specific check',
        description: 'Creating a corrective action from a failed check automatically links the two, creating a clear cause-and-effect audit trail.',
      },
      {
        title: 'Assign actions to a specific person',
        description: 'Unassigned actions are often forgotten. Always assign to a named team member with a target resolution date.',
      },
      {
        title: 'Mark resolved with evidence',
        description: 'When closing an action, describe exactly what was done to fix the issue. This is critical evidence during inspections.',
      },
    ],
    proTip: 'Aim to have zero open corrective actions older than 48 hours.',
  },

  payroll: {
    title: 'Payroll Guide',
    overview: 'Review worked hours and calculate payroll based on clock-in and clock-out records.',
    tips: [
      {
        title: 'Payroll is calculated from actual clock times',
        description: 'Only shifts where staff actually clocked in and out contribute. Scheduled-but-not-worked shifts are excluded.',
      },
      {
        title: 'Edit clock times before running payroll',
        description: 'If any clock times were incorrect (forgot to clock out, etc.), correct them in Shifts first.',
      },
      {
        title: 'Set hourly rates on each user',
        description: 'Ensure every staff member has an hourly rate set. Without a rate, their hours will show but the monetary total will be zero.',
      },
      {
        title: 'Export for your payroll provider',
        description: 'Download the CSV and import it into your payroll software (Xero Payroll, Sage, etc.).',
      },
    ],
    proTip: 'Run a preliminary payroll review mid-period so you can catch and correct errors before the final run.',
  },

  'my-pay': {
    title: 'My Pay Guide',
    overview: 'Your personal pay summary — hours worked, earnings calculated, and pay period breakdown.',
    tips: [
      {
        title: 'Pay is calculated from your clock records',
        description: 'Your pay is based on actual clocked hours, not scheduled hours. If you forget to clock in or out, contact your manager.',
      },
      {
        title: 'Check your hourly rate is correct',
        description: 'If your earnings look wrong, verify your hourly rate with your manager. They can update it in the Users section.',
      },
      {
        title: 'Navigate pay periods with the date picker',
        description: 'Switch between weekly or monthly views using the date range picker at the top.',
      },
    ],
    proTip: 'If you notice a discrepancy, check the Activity Log filtered by your own shifts — every clock-in and clock-out is recorded.',
  },

  invoices: {
    title: 'Invoices Guide',
    overview: 'Upload, scan, and manage supplier invoices with OCR processing.',
    tips: [
      {
        title: 'Upload supplier invoices for OCR scanning',
        description: 'Upload a photo or PDF of a supplier invoice. The system will extract line items, quantities, and prices automatically.',
      },
      {
        title: 'Review extracted data before approving',
        description: 'OCR isn\'t perfect — always review the extracted line items and correct any errors before approving the invoice.',
      },
      {
        title: 'Approved invoices can update inventory costs',
        description: 'When you apply an invoice, it can update your unit costs based on the latest supplier pricing.',
      },
    ],
    proTip: 'Take clear, well-lit photos of invoices for the best OCR accuracy. Avoid shadows and angles.',
  },

  integrations: {
    title: 'Integrations Guide',
    overview: 'Connect POS systems and accounting software to automate data flows.',
    tips: [
      {
        title: 'POS integrations automate stock deductions',
        description: 'Every sale on your POS automatically deducts the ingredients used from your inventory. No manual counting needed for sold items.',
      },
      {
        title: 'Accounting integrations export your data',
        description: 'Connect Xero or QuickBooks to push inventory costs and stock movement data into your accounting package.',
      },
      {
        title: 'Check the connection status indicator',
        description: 'Green = active. Yellow = connected but no recent activity. Red = configuration issue that needs attention.',
      },
    ],
    proTip: 'Set up POS before accounting — your accounting package will produce more accurate COGS figures once POS-driven stock deductions are flowing.',
  },

  categories: {
    title: 'Categories Guide',
    overview: 'Manage the category taxonomy used to organise inventory items.',
    tips: [
      {
        title: 'Categories filter inventory and reports',
        description: 'Every category you create here appears as a filter option in Inventory, Waste, and the Daily Summary report.',
      },
      {
        title: 'Rename categories with care',
        description: 'Renaming a category updates all inventory items using it. This is non-destructive but affects historical report filtering.',
      },
      {
        title: 'Keep your list concise',
        description: 'Aim for 6–12 categories maximum. Too many categories fragment your data and make filtering less useful.',
      },
    ],
    proTip: 'Align your categories with how your accountant tracks COGS (e.g. Food: Proteins, Beverages, Packaging) for cleaner exports.',
  },

  tags: {
    title: 'Tags Guide',
    overview: 'Apply flexible labels to inventory items for filtering beyond the main category system.',
    tips: [
      {
        title: 'Tags supplement categories',
        description: 'Use categories for broad grouping (e.g. Dairy) and tags for cross-cutting attributes (e.g. "gluten-free", "seasonal", "high-margin").',
      },
      {
        title: 'One item can have multiple tags',
        description: 'Apply as many tags as relevant. Filter by tag in Inventory to quickly isolate items sharing a characteristic.',
      },
      {
        title: 'Tags are store-specific',
        description: 'Tags created in one store are not shared with other stores. Each store has its own tag library.',
      },
    ],
    proTip: 'Create an "audit-priority" tag for your top 20 highest-value items. Filter by it during your weekly spot-check.',
  },
}
