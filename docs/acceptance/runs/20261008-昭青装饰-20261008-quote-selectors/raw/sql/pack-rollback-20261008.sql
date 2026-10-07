-- 仅回滚本次本地 dev 补充的套餐模板
DELETE FROM pack_line WHERE item_id = 233689892977115136;
DELETE FROM pack_section WHERE group_id = 233689494216245248;
DELETE FROM pack_template WHERE template_id = 233689493918449664;
