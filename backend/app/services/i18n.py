"""
Fixed messages patients see, in each language CivCare supports.

- "en":    English
- "sw":    Kiswahili sanifu, in plain everyday words (coast and anyone who
           prefers proper Kiswahili)
- "sheng": the Nairobi / Gen Z mix of Kiswahili, English and Sheng

Safety wording (emergency numbers, "should be checked quickly") stays plain
in every language: slang must never make a danger sign unclear. Times stay
as "2:00 PM" so nobody has to convert between clock and Swahili time.
"""

LANGS = ("en", "sw", "sheng")


def clean_lang(value) -> str:
    v = (value or "").strip().lower()
    return v if v in LANGS else "en"


M = {
    # ── Assistant: fixed safety and routing messages ──
    "safety_net": {
        "en": "If anything gets worse, call 999 or 112.",
        "sw": "Hali ikizidi kuwa mbaya, piga simu 999 au 112.",
        "sheng": "Ukianza kujiskia worse, piga 999 ama 112 haraka.",
    },
    # The middle phrase of urgent_check marks an escalation in the chat history.
    "urgent_marker": {
        "en": "should be checked by a clinician quickly",
        "sw": "kinahitaji kuchunguzwa na mhudumu wa afya haraka",
        "sheng": "inafaa ichekiwe na daktari haraka",
    },
    "urgent_check": {
        "en": "Thank you for telling me. What you've described {marker}. {safety} Would you like to go to a hospital now, or speak to a doctor online now?",
        "sw": "Asante kwa kuniambia. Ulichoeleza {marker}. {safety} Ungependa kwenda hospitalini sasa, au kuongea na daktari mtandaoni sasa hivi?",
        "sheng": "Asante kwa kuniambia. Hii kitu unadescribe {marker}. {safety} Ungependa kuenda hosi sasa, ama uongee na daktari online saa hii?",
    },
    "route_hospital": {
        "en": "Thank you{name}. I've written up everything you told me for the doctor. Choose a hospital near you below and your file will be ready when you arrive. {safety}",
        "sw": "Asante{name}. Nimeandika kila kitu ulichoniambia kwa ajili ya daktari. Chagua hospitali iliyo karibu nawe hapa chini, na faili lako litakuwa tayari utakapofika. {safety}",
        "sheng": "Asante{name}. Nimeandika kila kitu umeniambia ndio daktari ajue. Chagua hosi iko karibu na wewe hapo chini, file yako itakuwa ready ukifika. {safety}",
    },
    "route_online": {
        "en": "Thank you{name}. I've written up everything you told me for the doctor. Choose a doctor below to speak with online. {safety}",
        "sw": "Asante{name}. Nimeandika kila kitu ulichoniambia kwa ajili ya daktari. Chagua daktari hapa chini ili kuongea naye mtandaoni. {safety}",
        "sheng": "Asante{name}. Nimeandika kila kitu umeniambia ndio daktari ajue. Chagua daktari hapo chini muongee online. {safety}",
    },
    "emergency": {
        "en": "What you're describing can be an emergency. Call 999 or 112 now, or get to the nearest hospital emergency department.",
        "sw": "Ulichoeleza kinaweza kuwa dharura. Piga simu 999 au 112 sasa hivi, au fika kitengo cha dharura cha hospitali iliyo karibu.",
        "sheng": "Hii kitu unadescribe inaweza kuwa emergency. Piga 999 ama 112 saa hii, ama fika emergency ya hosi iko karibu.",
    },
    "emergency_airway": {
        "en": " If someone isn't breathing and you're trained, start CPR.",
        "sw": " Ikiwa mtu hapumui na umefunzwa, anza CPR.",
        "sheng": " Kama mtu hapumui na unajua kufanya CPR, anza CPR.",
    },
    "emergency_bleed": {
        "en": " If there's heavy bleeding, press firmly on the wound with a clean cloth.",
        "sw": " Ikiwa damu inatoka kwa wingi, bonyeza kidonda kwa nguvu kwa kitambaa safi.",
        "sheng": " Kama damu inatoka mingi, bonyeza kidonda kwa nguvu na kitambaa safi.",
    },
    "emergency_tail": {
        "en": " Nearby hospitals are below.",
        "sw": " Hospitali zilizo karibu ziko hapa chini.",
        "sheng": " Hosi ziko karibu ziko hapo chini.",
    },
    "pre_hospital": {
        "en": "Thank you, I have gathered enough information. Preparing your file now...",
        "sw": "Asante, nimepata maelezo ya kutosha. Ninaandaa faili lako sasa...",
        "sheng": "Asante, nimepata info ya kutosha. Naprepare file yako saa hii...",
    },
    "pre_consult": {
        "en": "Thank you. Your file is ready. Connecting you to the doctor now...",
        "sw": "Asante. Faili lako liko tayari. Ninakuunganisha na daktari sasa...",
        "sheng": "Asante. File yako iko ready. Nakuconnect na daktari saa hii...",
    },
    "ask_travel": {
        "en": "Are you able to travel to a nearby hospital or clinic today, or would you prefer to speak to a doctor online?",
        "sw": "Je, unaweza kusafiri hadi hospitali au kliniki iliyo karibu leo, au ungependa kuongea na daktari mtandaoni?",
        "sheng": "Unaweza fika hosi ama clinic iko karibu leo, ama ungependa kuongea na daktari online?",
    },
    "ask_travel_thanks": {
        "en": "Thank you for sharing all of that with me. ",
        "sw": "Asante kwa kunieleza hayo yote. ",
        "sheng": "Asante kwa kunieleza hizo zote. ",
    },
    "fallback": {
        "en": "I am having trouble processing that right now. Please try again.",
        "sw": "Nina tatizo kidogo kwa sasa. Tafadhali jaribu tena.",
        "sheng": "Kuna shida kidogo upande wangu saa hii. Jaribu tena tafadhali.",
    },

    # ── Phone notifications (lock screen: never a medicine or diagnosis) ──
    "push_dose_title": {"en": "Time for your medicine", "sw": "Ni wakati wa dawa yako", "sheng": "Saa ya dawa yako imefika"},
    "push_dose_body": {
        "en": "Your {time} dose is due. Tap to log it.",
        "sw": "Dozi yako ya {time} imefika. Gusa hapa kuirekodi.",
        "sheng": "Doz yako ya {time} imefika. Gusa hapa uirekodi.",
    },
    "push_missed_title": {"en": "Did you take your medicine?", "sw": "Je, umemeza dawa yako?", "sheng": "Umekunywa dawa?"},
    "push_missed_body": {
        "en": "You haven't logged your {time} dose yet. Tap to log it, or tell us why you skipped it.",
        "sw": "Bado hujarekodi dozi yako ya {time}. Gusa hapa kuirekodi, au utuambie kwa nini hukuimeza.",
        "sheng": "Bado hujarekodi doz yako ya {time}. Gusa hapa uirekodi, ama utuambie mbona uliiskip.",
    },
    "push_called_title": {"en": "The doctor is ready for you", "sw": "Daktari yuko tayari kukuona", "sheng": "Daktari yuko ready kukuona"},
    "push_called_body": {"en": "{doctor} is calling you in now.", "sw": "{doctor} anakuita sasa.", "sheng": "{doctor} anakuita saa hii."},
    "push_consult_title": {"en": "Your online doctor is ready", "sw": "Daktari wako wa mtandaoni yuko tayari", "sheng": "Daktari wako wa online yuko ready"},
    "push_consult_body": {
        "en": "Your video consultation is starting. Tap to join.",
        "sw": "Mashauriano yako ya video yanaanza. Gusa hapa kujiunga.",
        "sheng": "Video call yako na daktari inaanza. Gusa hapa uingie.",
    },
    "push_phone_title": {"en": "Your doctor is calling you", "sw": "Daktari wako anakupigia simu", "sheng": "Daktari anakupigia"},
    "push_phone_body": {
        "en": "Pick up your phone: the doctor for your online consultation is calling now.",
        "sw": "Pokea simu yako: daktari wa mashauriano yako ya mtandaoni anakupigia sasa.",
        "sheng": "Shika simu: daktari wako wa online anakupigia saa hii.",
    },
    "push_followup_title": {"en": "How are you feeling now?", "sw": "Unajisikiaje sasa?", "sheng": "Unajiskia aje saa hii?"},
    "push_followup_body": {
        "en": "Your treatment has finished. Tell us how you feel, and we'll help if you're still unwell.",
        "sw": "Matibabu yako yamekamilika. Tuambie unavyojisikia, na tutakusaidia kama bado hujapona.",
        "sheng": "Dawa zako zimeisha. Tuambie unajiskia aje, tutakusaidia kama bado hauko fiti.",
    },
    "push_test_title": {"en": "CivCare notifications are on", "sw": "Arifa za CivCare zimewashwa", "sheng": "Notifications za CivCare ziko on"},
    "push_test_body": {
        "en": "You'll get dose reminders here, even when CivCare is closed.",
        "sw": "Utapata vikumbusho vya dozi hapa, hata CivCare ikiwa imefungwa.",
        "sheng": "Utapata reminders za doz hapa, hata kama CivCare imefungwa.",
    },

    # ── SMS (TAKEN / SKIP stay in English: the SMS reader expects them) ──
    "sms_dose": {
        "en": "CivCare Reminder\nTime to take: {med} — {dose}\nReply TAKEN if you have taken this dose.\nReply SKIP if you cannot take it right now.",
        "sw": "Kikumbusho cha CivCare\nWakati wa kumeza: {med} — {dose}\nJibu TAKEN ukishameza dozi hii.\nJibu SKIP kama huwezi kuimeza sasa.",
        "sheng": "CivCare Reminder\nSaa ya kumeza: {med} — {dose}\nReply TAKEN ukishameza.\nReply SKIP kama huwezi saa hii.",
    },
    "sms_called": {
        "en": "CivCare\nDr. {doctor} is ready to see you now.\nPlease proceed to the consultation room.",
        "sw": "CivCare\nDkt. {doctor} yuko tayari kukuona sasa.\nTafadhali nenda kwenye chumba cha daktari.",
        "sheng": "CivCare\nDkt. {doctor} yuko ready kukuona saa hii.\nTafadhali enda kwa room ya daktari.",
    },
}


def msg(key: str, lang: str = "en", **values) -> str:
    entry = M[key]
    text = entry.get(clean_lang(lang)) or entry["en"]
    return text.format(**values) if values else text


def all_versions(key: str) -> tuple:
    return tuple(M[key].values())
