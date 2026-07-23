import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';

/// Job categories — mirrors src/lib/jobs.ts exactly (slug + Burmese label).
const _jobCategories = <(String, String, String)>[
  ("agriculture", "Agriculture", "🌱"),
  ("sales", "Sales", "🛒"),
  ("it", "IT", "💻"),
  ("admin", "Admin", "🗂️"),
  ("finance", "Finance", "💰"),
  ("engineering", "Engineering", "🛠️"),
  ("driver", "Driver", "🚚"),
  ("construction", "Construction", "🏗️"),
  ("hospitality", "Hospitality", "🍽️"),
  ("healthcare", "Healthcare", "🩺"),
  ("education", "Education", "📚"),
  ("design", "Design", "🎨"),
  ("other", "Other", "📌"),
];

const _employmentTypes = <String, String>{
  "full_time": "Full-time",
  "part_time": "Part-time",
  "contract": "Contract",
  "internship": "Internship",
  "temporary": "Temporary",
  "remote": "Remote",
};

String _catEmoji(String slug) {
  for (final c in _jobCategories) {
    if (c.$1 == slug) return c.$3;
  }
  return "📌";
}

String _catLabel(String slug) {
  for (final c in _jobCategories) {
    if (c.$1 == slug) return c.$2;
  }
  return slug;
}

String _salary(Job j) {
  if (j.salaryMin == null && j.salaryMax == null) return "Salary negotiable";
  final min = j.salaryMin != null ? money(j.salaryMin, j.salaryCurrency) : null;
  final max = j.salaryMax != null ? money(j.salaryMax, j.salaryCurrency) : null;
  if (min != null && max != null) return "$min – $max";
  return min ?? max!;
}

/// Native Jobs board — search, category chips, listings from the `jobs`
/// table, a full detail screen and a native application form.
class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  String? _category;
  List<Job> _jobs = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final j = await context.read<AppState>().repo.jobs(
            category: _category,
            q: _search.text,
          );
      if (mounted) setState(() => _jobs = j);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onSearch(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
  }

  /// Web features open in the signed-in in-app browser — never the external
  /// browser, where no session exists.
  Future<void> _openWeb(String path) => openWeb(context, path);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Jobs"),
        actions: [
          TextButton.icon(
            onPressed: () => _openWeb("/jobs/new"),
            icon: const Icon(Icons.add, size: 18),
            label: Text(tr(context, "Post a job", "အလုပ်ခေါ်ရန်")),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _search,
              onChanged: _onSearch,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _load(),
              decoration: InputDecoration(
                hintText: tr(context, "Search roles / companies…", "ရာထူး / company ရှာရန်…"),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _search.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () {
                          _search.clear();
                          _load();
                        },
                      )
                    : null,
              ),
            ),
          ),
          SizedBox(
            height: 46,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    selected: _category == null,
                    onSelected: (_) {
                      setState(() => _category = null);
                      _load();
                    },
                    label: Text(tr(context, "All", "အားလုံး")),
                    selectedColor: GwColors.primary.withValues(alpha: 0.15),
                  ),
                ),
                for (final c in _jobCategories)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      selected: _category == c.$1,
                      onSelected: (_) {
                        setState(
                            () => _category = _category == c.$1 ? null : c.$1);
                        _load();
                      },
                      label: Text("${c.$3} ${c.$2}"),
                      selectedColor: GwColors.primary.withValues(alpha: 0.15),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: GwColors.primary,
              onRefresh: _load,
              child: _loading && _jobs.isEmpty
                  ? const Center(
                      child:
                          CircularProgressIndicator(color: GwColors.primary))
                  : _error != null && _jobs.isEmpty
                      ? ListView(children: [
                          const SizedBox(height: 80),
                          GwEmpty(
                              icon: Icons.cloud_off,
                              title: "Couldn't load jobs",
                              subtitle: _error),
                        ])
                      : _jobs.isEmpty
                          ? ListView(children: [
                              const SizedBox(height: 80),
                              GwEmpty(
                                icon: Icons.work_outline,
                                title: tr(context, "No job posts yet", "အလုပ်ခေါ်စာ မရှိသေးပါ"),
                                subtitle: tr(context, "Be the first to post one!", "ပထမဆုံး ခေါ်တဲ့သူ ဖြစ်လိုက်ပါ!"),
                              ),
                            ])
                          : ListView.builder(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 6, 16, 40),
                              itemCount: _jobs.length,
                              itemBuilder: (_, i) => _jobCard(_jobs[i]),
                            ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _jobCard(Job j) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.lg),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => JobDetailScreen(job: j)),
        ),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: GwColors.surface,
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(_catEmoji(j.category),
                      style: const TextStyle(fontSize: 26)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(j.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 15.5)),
                        Text(
                          [
                            if (j.company != null && j.company!.isNotEmpty)
                              j.company!,
                            if (j.location != null && j.location!.isNotEmpty)
                              j.location!,
                          ].join(" · "),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: GwColors.inkSoft, fontSize: 12.5),
                        ),
                      ],
                    ),
                  ),
                  Text(timeAgo(j.createdAt),
                      style: const TextStyle(
                          color: GwColors.inkSoft, fontSize: 11.5)),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  GwPill(
                    label: _employmentTypes[j.employmentType] ??
                        j.employmentType,
                    color: GwColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(_salary(j),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: GwColors.primaryDark)),
                  ),
                  const Icon(Icons.chevron_right, color: GwColors.inkSoft),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Full job detail + the native application form.
class JobDetailScreen extends StatelessWidget {
  const JobDetailScreen({super.key, required this.job});
  final Job job;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_catLabel(job.category))),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: GwColors.surface,
                shape: const RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(GwRadius.lg)),
                ),
                builder: (_) => _ApplySheet(job: job),
              ),
              icon: const Icon(Icons.send, size: 19),
              label: Text(tr(context, "Apply", "လျှောက်မည်")),
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_catEmoji(job.category),
                  style: const TextStyle(fontSize: 40)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(job.title,
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 2),
                    Text(
                      [
                        if (job.company != null && job.company!.isNotEmpty)
                          job.company!,
                        if (job.location != null && job.location!.isNotEmpty)
                          job.location!,
                      ].join(" · "),
                      style: const TextStyle(color: GwColors.inkSoft),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              GwPill(
                  label:
                      _employmentTypes[job.employmentType] ?? job.employmentType,
                  color: GwColors.primary),
              GwPill(label: _salary(job), color: GwColors.gold),
              if (job.employer != null)
                GwPill(
                    label: "${tr(context, "Posted by", "ခေါ်သူ")} — ${job.employer!.displayName}",
                    color: GwColors.inkSoft),
            ],
          ),
          const SizedBox(height: 18),
          _section(tr(context, "About the job", "အလုပ် အကြောင်းအရာ"), job.description),
          if (job.requirements != null && job.requirements!.isNotEmpty)
            _section(tr(context, "Requirements", "လိုအပ်ချက်များ"), job.requirements!),
          if (job.contact != null && job.contact!.isNotEmpty)
            _section(tr(context, "Contact", "ဆက်သွယ်ရန်"), job.contact!),
        ],
      ),
    );
  }

  Widget _section(String title, String body) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: GwColors.surface,
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 14.5)),
            const SizedBox(height: 8),
            Text(body, style: const TextStyle(height: 1.5, fontSize: 14)),
          ],
        ),
      ),
    );
  }
}

/// The native application form: name, phone, experience, expected salary,
/// cover letter — plus the employer's custom questions when the job has any.
class _ApplySheet extends StatefulWidget {
  const _ApplySheet({required this.job});
  final Job job;

  @override
  State<_ApplySheet> createState() => _ApplySheetState();
}

class _ApplySheetState extends State<_ApplySheet> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _cover = TextEditingController();
  final _salary = TextEditingController();
  final _years = TextEditingController();
  late final List<TextEditingController> _answers = [
    for (final _ in widget.job.questions) TextEditingController()
  ];
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final me = context.read<AppState>().me;
    _name.text = me?.displayName ?? "";
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _cover.dispose();
    _salary.dispose();
    _years.dispose();
    for (final a in _answers) {
      a.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (_name.text.trim().length < 2 || _phone.text.trim().length < 3) {
      setState(() => _error = tr(context, "Enter your name and phone number.", "အမည်နဲ့ ဖုန်းနံပါတ် ထည့်ပါ။"));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AppState>().repo.applyJob(
            jobId: widget.job.id,
            fullName: _name.text,
            phone: _phone.text,
            coverLetter: _cover.text,
            expectedSalary: double.tryParse(_salary.text.trim()),
            experienceYears: int.tryParse(_years.text.trim()),
            answers: [
              for (var i = 0; i < widget.job.questions.length; i++)
                {"q": widget.job.questions[i], "a": _answers[i].text.trim()},
            ],
          );
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr(context, "Application submitted ✓",
                "လျှောက်လွှာ တင်ပြီးပါပြီ ✓")),
            backgroundColor: GwColors.primary,
          ),
        );
      }
    } catch (e) {
      final msg = e.toString();
      if (mounted) {
        setState(() {
          _busy = false;
          _error = msg.contains("duplicate") || msg.contains("unique")
              ? tr(context, "You already applied to this job.", "ဒီအလုပ်ကို လျှောက်ထားပြီးသားပါ။")
              : msg;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("${tr(context, "Apply", "လျှောက်ရန်")} — ${widget.job.title}",
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            const SizedBox(height: 14),
            TextField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(
                labelText: tr(context, "Full name", "အမည်"),
                prefixIcon: Icon(Icons.person_outline),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: tr(context, "Phone", "ဖုန်းနံပါတ်"),
                prefixIcon: Icon(Icons.phone_outlined),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _years,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: InputDecoration(
                      labelText: tr(context, "Experience (years)", "အတွေ့အကြုံ (နှစ်)"),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _salary,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: InputDecoration(
                      labelText: tr(context, "Expected salary", "မျှော်မှန်းလစာ"),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _cover,
              maxLines: 4,
              maxLength: 3000,
              decoration: InputDecoration(
                labelText: tr(context, "Cover letter", "ကိုယ်ရေးအကျဉ်း / Cover letter"),
                alignLabelWithHint: true,
              ),
            ),
            for (var i = 0; i < widget.job.questions.length; i++) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _answers[i],
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: widget.job.questions[i],
                  alignLabelWithHint: true,
                ),
              ),
            ],
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error!,
                    style:
                        const TextStyle(color: GwColors.live, fontSize: 13)),
              ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            valueColor: AlwaysStoppedAnimation(Colors.white)))
                    : Text(tr(context, "Submit application", "လျှောက်လွှာ တင်မည်")),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
