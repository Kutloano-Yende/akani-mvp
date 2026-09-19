-- Demo data for exercising every stage of the funnel in a fresh environment.
-- Safe to skip/delete for a real deployment.
insert into companies (id, external_id, source, name, registration_number, industry, province, city, employee_count, revenue_range, website, phone, email, address, opportunity_score, opportunity_level)
values
  (gen_random_uuid(), 'bdm-001', 'BDM DataFinder', 'ABC Construction (Pty) Ltd', '2015/123456/07', 'Construction', 'Gauteng', 'Johannesburg', 120, 'R10m - R50m', 'abcconstruction.co.za', '011 555 0101', 'info@abcconstruction.co.za', '12 Main Rd, Johannesburg', 87, 'high'),
  (gen_random_uuid(), 'bdm-002', 'BDM DataFinder', 'XYZ Holdings', '2012/987654/07', 'Manufacturing', 'Gauteng', 'Pretoria', 65, 'R5m - R10m', 'xyzholdings.co.za', '012 555 0102', 'contact@xyzholdings.co.za', '45 Industrial Ave, Pretoria', 61, 'medium'),
  (gen_random_uuid(), 'bdm-003', 'BDM DataFinder', 'Ubuntu Logistics', '2018/456789/07', 'Transport & Logistics', 'KwaZulu-Natal', 'Durban', 90, 'R10m - R50m', 'ubuntulogistics.co.za', '031 555 0103', 'hello@ubuntulogistics.co.za', '8 Harbour St, Durban', 74, 'high'),
  (gen_random_uuid(), 'bdm-004', 'BDM DataFinder', 'Cape Coastal Engineering', '2010/112233/07', 'Engineering', 'Western Cape', 'Cape Town', 55, 'R5m - R10m', 'capecoastal.co.za', '021 555 0104', 'info@capecoastal.co.za', '3 Dock Rd, Cape Town', 52, 'medium'),
  (gen_random_uuid(), 'bdm-005', 'BDM DataFinder', 'Thabo Retail Group', '2016/334455/07', 'Retail', 'Gauteng', 'Sandton', 200, 'R50m+', 'thaboretail.co.za', '011 555 0105', 'info@thaboretail.co.za', '1 Rivonia Rd, Sandton', 45, 'low'),
  (gen_random_uuid(), 'bdm-006', 'BDM DataFinder', 'Nkosi Agri Supplies', '2014/667788/07', 'Agriculture', 'Free State', 'Bloemfontein', 40, 'R1m - R5m', 'nkosiagri.co.za', '051 555 0106', 'sales@nkosiagri.co.za', '22 Farm Rd, Bloemfontein', 68, 'medium'),
  (gen_random_uuid(), 'bdm-007', 'BDM DataFinder', 'Mzansi Facilities Management', '2013/889900/07', 'Facilities Management', 'Gauteng', 'Midrand', 150, 'R10m - R50m', 'mzansifm.co.za', '011 555 0107', 'info@mzansifm.co.za', '9 New Rd, Midrand', 91, 'high'),
  (gen_random_uuid(), 'bdm-008', 'BDM DataFinder', 'Ekhaya Property Developers', '2011/223344/07', 'Construction', 'Eastern Cape', 'Gqeberha', 80, 'R10m - R50m', 'ekhayaproperty.co.za', '041 555 0108', 'info@ekhayaproperty.co.za', '5 Beach Rd, Gqeberha', 58, 'medium');

insert into contacts (company_id, first_name, last_name, job_title, email, phone, source)
select id, 'John', 'Smith', 'Managing Director', 'john@' || split_part(website, '//', 1), phone, source from companies where external_id = 'bdm-001';
insert into contacts (company_id, first_name, last_name, job_title, email, phone, source)
select id, 'Naledi', 'Mokoena', 'CFO', 'naledi@' || website, phone, source from companies where external_id = 'bdm-002';
insert into contacts (company_id, first_name, last_name, job_title, email, phone, source)
select id, 'Sipho', 'Dlamini', 'Operations Manager', 'sipho@' || website, phone, source from companies where external_id = 'bdm-003';
insert into contacts (company_id, first_name, last_name, job_title, email, phone, source)
select id, 'Anele', 'Botha', 'CEO', 'anele@' || website, phone, source from companies where external_id = 'bdm-004';
insert into contacts (company_id, first_name, last_name, job_title, email, phone, source)
select id, 'Priya', 'Naidoo', 'Procurement Lead', 'priya@' || website, phone, source from companies where external_id = 'bdm-005';
insert into contacts (company_id, first_name, last_name, job_title, email, phone, source)
select id, 'Kabelo', 'Molefe', 'Owner', 'kabelo@' || website, phone, source from companies where external_id = 'bdm-006';
insert into contacts (company_id, first_name, last_name, job_title, email, phone, source)
select id, 'Zanele', 'Khumalo', 'Managing Director', 'zanele@' || website, phone, source from companies where external_id = 'bdm-007';
insert into contacts (company_id, first_name, last_name, job_title, email, phone, source)
select id, 'David', 'van Wyk', 'Director', 'david@' || website, phone, source from companies where external_id = 'bdm-008';

insert into opportunity_signals (company_id, signal_type, description, weight, source)
select id, 'INDUSTRY_MATCH', 'Construction industry matches target profile', 3, 'BDM DataFinder' from companies where external_id in ('bdm-001','bdm-008');
insert into opportunity_signals (company_id, signal_type, description, weight, source)
select id, 'COMPANY_SIZE_MATCH', 'Company size matches target profile', 2, 'BDM DataFinder' from companies where employee_count between 50 and 200;
insert into opportunity_signals (company_id, signal_type, description, weight, source)
select id, 'LOCATION_MATCH', 'Located in a priority province', 1, 'BDM DataFinder' from companies where province in ('Gauteng','KwaZulu-Natal');
insert into opportunity_signals (company_id, signal_type, description, weight, source)
select id, 'CONTACT_AVAILABLE', 'Contact information available', 1, 'BDM DataFinder' from companies;
insert into opportunity_signals (company_id, signal_type, description, weight, source)
select id, 'BUSINESS_ACTIVITY', 'Requires qualification review', 1, 'BDM DataFinder' from companies where opportunity_level = 'high';

insert into prospects (company_id, status, qualification_status, opportunity_score, first_contacted_at, qualified_at)
select id, 'qualified', 'Requires qualification review', opportunity_score, null, now() - interval '3 days' from companies where external_id = 'bdm-001';
insert into prospects (company_id, status, qualification_status, opportunity_score)
select id, 'identified', null, opportunity_score from companies where external_id = 'bdm-002';
insert into prospects (company_id, status, qualification_status, opportunity_score, first_contacted_at)
select id, 'contacted', 'Qualified', opportunity_score, now() - interval '5 days' from companies where external_id = 'bdm-003';
insert into prospects (company_id, status, qualification_status, opportunity_score)
select id, 'identified', null, opportunity_score from companies where external_id = 'bdm-004';
insert into prospects (company_id, status, qualification_status, opportunity_score)
select id, 'lost', 'Not a fit', opportunity_score from companies where external_id = 'bdm-005';
insert into prospects (company_id, status, qualification_status, opportunity_score, first_contacted_at)
select id, 'interested', 'Qualified', opportunity_score, now() - interval '10 days' from companies where external_id = 'bdm-006';
insert into prospects (company_id, status, qualification_status, opportunity_score, first_contacted_at, qualified_at, converted_at)
select id, 'won', 'Qualified', opportunity_score, now() - interval '30 days', now() - interval '25 days', now() - interval '2 days' from companies where external_id = 'bdm-007';
insert into prospects (company_id, status, qualification_status, opportunity_score, first_contacted_at)
select id, 'application', 'Qualified', opportunity_score, now() - interval '15 days' from companies where external_id = 'bdm-008';
